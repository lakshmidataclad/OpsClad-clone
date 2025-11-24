from PIL import Image
import pandas as pd
from collections import OrderedDict
from urllib3.util.retry import Retry
import re
import datetime
import sys
import os
import requests
import json
from typing import Dict, Optional, List



def extract_text_with_ocrspace(image_path: str,
                               timeout: int = 120,
                               max_attempts: int = 4,
                               backoff_base: float = 1.5,
                               use_local_fallback: bool = True) -> str:
    """
    Robust OCR.Space call that retries on transient errors including E101.
    - Retries the POST when OCR returns E101 or on ReadTimeout/ConnectionError.
    - Exponential backoff between attempts.
    - Optional local pytesseract fallback if OCR.Space repeatedly fails.
    """
    import io
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    import time
    try:
        ocr_api_key = os.getenv('OCR_KEY')
        if not ocr_api_key:
            raise ValueError("OCR_KEY environment variable is required")

        url = "https://api.ocr.space/parse/image"
        payload = {
            'apikey': ocr_api_key,
            'language': 'eng',
            'isOverlayRequired': 'false',
            'detectOrientation': 'false',
            'isTable': 'true',
            'scale': 'true',
            'OCREngine': '2'
        }

        print(f"🔍 OCR.Space extract for: {os.path.basename(image_path)}", file=sys.stderr)

        # Prepare file (compress if large) - same small helper inline
        def compress_if_large(path):
            max_size = 2_000_000
            if os.path.getsize(path) <= max_size:
                return open(path, 'rb')
            img = Image.open(path).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=70)
            buf.seek(0)
            return buf

        file_obj = compress_if_large(image_path)

        # Prepare session with basic retries for connection-level errors
        session = requests.Session()
        retries = Retry(total=2, backoff_factor=0.2, status_forcelist=[429, 500, 502, 503, 504])
        session.mount("https://", HTTPAdapter(max_retries=retries))
        session.mount("http://", HTTPAdapter(max_retries=retries))

        last_error = None
        for attempt in range(1, max_attempts + 1):
            try:
                print(f"📡 Attempt {attempt}/{max_attempts} - sending to OCR.Space (timeout={timeout}s)...", file=sys.stderr)
                # rewind buffer if necessary
                try:
                    file_obj.seek(0)
                except Exception:
                    pass

                response = session.post(url, files={'file': file_obj}, data=payload, timeout=timeout)

                if response is None:
                    raise Exception("No response (session retries exhausted)")

                # if non-200, raise and potentially retry
                if response.status_code != 200:
                    last_error = Exception(f"Status {response.status_code}: {response.text[:500]}")
                    print(f"⚠ Non-200 status: {response.status_code}", file=sys.stderr)
                    raise last_error

                # parse json
                try:
                    result = response.json()
                except ValueError:
                    last_error = Exception("Invalid JSON response from OCR.Space")
                    raise last_error

                # If OCRExitCode indicates failure, check ErrorMessage for E101 and retry
                exit_code = result.get('OCRExitCode')
                if exit_code != 1:
                    errs = result.get('ErrorMessage') or result.get('ErrorDetails') or []
                    # normalize to list of strings
                    if isinstance(errs, str):
                        errs = [errs]
                    # detect E101 (timed out waiting)
                    joined_errs = " ".join(str(e).upper() for e in errs)
                    print(f"❗ OCR returned exit code {exit_code}, errors: {joined_errs}", file=sys.stderr)

                    if "E101" in joined_errs or "TIMED OUT" in joined_errs or response.status_code in (429, 503):
                        # transient: sleep and retry
                        wait = backoff_base ** (attempt - 1)
                        print(f"⏳ Transient OCR error detected (E101 or timeout). Backing off {wait:.1f}s then retrying...", file=sys.stderr)
                        time.sleep(wait)
                        last_error = Exception(f"OCR transient error: {joined_errs}")
                        continue
                    else:
                        # non-transient error: raise immediately
                        raise Exception(f"OCR failed: {errs}")

                parsed = result.get('ParsedResults') or []
                if not parsed:
                    last_error = Exception("No ParsedResults returned")
                    raise last_error

                extracted_text = parsed[0].get('ParsedText', '')
                if not extracted_text.strip():
                    last_error = Exception("Empty ParsedText")
                    raise last_error

                print(f"✅ OCR success (len={len(extracted_text)}).", file=sys.stderr)
                return extracted_text

            except requests.exceptions.ReadTimeout as rt:
                last_error = rt
                wait = backoff_base ** (attempt - 1)
                print(f"❌ ReadTimeout on attempt {attempt}: {rt}. Sleeping {wait:.1f}s and retrying...", file=sys.stderr)
                time.sleep(wait)
                continue
            except requests.exceptions.ConnectionError as ce:
                last_error = ce
                wait = backoff_base ** (attempt - 1)
                print(f"❌ ConnectionError on attempt {attempt}: {ce}. Sleeping {wait:.1f}s and retrying...", file=sys.stderr)
                time.sleep(wait)
                continue
            except Exception as e:
                # Non-transient / final error - either propagate or break to fallback
                last_error = e
                # If this is not explicitly transient, break and fallback
                print(f"❌ Attempt {attempt} failed with error: {e}", file=sys.stderr)
                # If last attempt, we'll break out and go to fallback
                if attempt < max_attempts:
                    wait = backoff_base ** (attempt - 1)
                    print(f"⏳ Waiting {wait:.1f}s before next attempt...", file=sys.stderr)
                    time.sleep(wait)
                    continue
                else:
                    break

        # If we get here OCR.Space failed after retries
        print(f"⚠ OCR.Space failed after {max_attempts} attempts. Last error: {last_error}", file=sys.stderr)

        # Optional: fallback to local pytesseract if available
        if use_local_fallback:
            try:
                print("🔁 Falling back to local pytesseract...", file=sys.stderr)
                # rewind and open image for pytesseract
                try:
                    file_obj.seek(0)
                    img = Image.open(file_obj)
                except Exception:
                    img = Image.open(image_path)
                import pytesseract
                local_text = pytesseract.image_to_string(img)
                if local_text and local_text.strip():
                    print("✅ Local pytesseract succeeded.", file=sys.stderr)
                    return local_text
                else:
                    print("⚠ Local pytesseract returned no text.", file=sys.stderr)
            except Exception as local_err:
                print(f"⚠ Local pytesseract fallback failed: {local_err}", file=sys.stderr)

        # final failure
        raise Exception(f"OCR failed after {max_attempts} attempts. Last error: {last_error}")

    except Exception as final_e:
        print(f"❌ Error during OCR extraction: {final_e}", file=sys.stderr)
        raise


def extract_timesheet_from_ocr_text(text: str, image_path: str) -> Dict:
    """
    Extract timesheet data from OCR text using patterns specific to the timesheet format.
    Updated to handle the specific layout and include activity classification.
    """
    results = {
        "Select Project": None,
        "Daily Hours": {},
        "Work Entries": [],  # New: Structured work entries with activity
        "Total Hours": None,
        "PTO Data": None,
        "start_date": None
    }

    try:
        print(f"🔍 Parsing timesheet data from OCR text...", file=sys.stderr)

        # Days of the week mapping
        days_of_week = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        
        # Extract date range (From DD-MM-YYYY To DD-MM-YYYY format)
        date_patterns = [
            r'From\s+(\d{2}-\d{2}-\d{4})\s+To\s+(\d{2}-\d{2}-\d{4})',
            r'(\d{2}-\d{2}-\d{4})\s+To\s+(\d{2}-\d{2}-\d{4})',
            r'From\s*(\d{2}-\d{2}-\d{4})\s*To\s*(\d{2}-\d{2}-\d{4})'
        ]

        start_date = None
        for pattern in date_patterns:
            date_match = re.search(pattern, text)
            if date_match:
                try:
                    start_date = datetime.datetime.strptime(date_match.group(1), '%d-%m-%Y').date()
                    results["start_date"] = start_date
                    print(f"📅 Found date range: {date_match.group(1)} to {date_match.group(2)}", file=sys.stderr)
                    break
                except ValueError:
                    print(f"⚠️ Could not parse date: {date_match.group(1)}", file=sys.stderr)
                    continue

        # Extract project name - look for "Seymour Whyte Connect" or similar patterns
        project_patterns = [
            r'Seymour\s+Whyte\s+Connect',
            r'Select\s+Project[^\n]*Seymour[^\n]*Whyte[^\n]*Connect',
            r'Project[^\n]*Seymour[^\n]*Whyte'
        ]

        for pattern in project_patterns:
            project_match = re.search(pattern, text, re.IGNORECASE)
            if project_match:
                results["Select Project"] = "Seymour Whyte Connect"
                print(f"🏗️ Found project: {results['Select Project']}", file=sys.stderr)
                break

        # Default project if not found
        if not results["Select Project"]:
            results["Select Project"] = "Seymour Whyte Connect"

        # --- FIX STARTS HERE ---
        # First, extract and process all PTO/Leave data
        pto_entries = []
        pto_dates = set()

        # Pattern to find 'Leave' or 'PTO' followed by the daily hours
        leave_line_pattern = r'(?:Leave|PTO)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)'

        leave_match = re.search(leave_line_pattern, text, re.IGNORECASE)
        if leave_match and start_date:
            print(f"🏖️ Found a potential Leave line.", file=sys.stderr)
            hours_values = [float(h) for h in leave_match.groups()]
            
            for i, hours in enumerate(hours_values):
                # Only process entries with non-zero hours
                if hours > 0:
                    current_date = start_date + datetime.timedelta(days=i)
                    date_str = current_date.strftime('%m/%d/%Y')
                    day_str = days_of_week[i]

                    # Check for duplicates before adding
                    if date_str not in pto_dates:
                        pto_entry = {
                            "date": date_str,
                            "day": day_str,
                            "hours": hours,
                            "type": "Leave",
                            "activity": "PTO"
                        }
                        pto_entries.append(pto_entry)
                        pto_dates.add(date_str)
                        print(f"✅ Found and added PTO entry for {day_str} {date_str} with {hours} hours.", file=sys.stderr)
                    else:
                        print(f"⚠️ Duplicate PTO entry for {date_str} ignored.", file=sys.stderr)

        results["PTO Data"] = pto_entries
        
        # Now, extract work entries, but skip any day that has a PTO entry.
        hours_extracted = False
        
        # Look for the day totals row - this contains the daily hours
        day_total_patterns = [
            r'Day\s+Total\s*\(hrs\)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)',
            r'Day\s+Total[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)[^\d]*?(\d+\.?\d*)'
        ]

        for pattern in day_total_patterns:
            day_total_match = re.search(pattern, text, re.IGNORECASE)
            if day_total_match:
                print(f"📊 Found Day Total row with hours", file=sys.stderr)
                hours_values = [float(h) for h in day_total_match.groups()]
                
                if start_date:
                    for i, hours in enumerate(hours_values[:7]):
                        current_date = start_date + datetime.timedelta(days=i)
                        date_str = current_date.strftime('%m/%d/%Y')
                        
                        # Only create a work entry if the day is not a PTO day
                        if date_str not in pto_dates and hours > 0:
                            day_key = f"{days_of_week[i]} {date_str}"
                            results["Daily Hours"][day_key] = hours
                            
                            work_entry = {
                                "date": date_str,
                                "day": days_of_week[i],
                                "hours": hours,
                                "activity": "Work"
                            }
                            results["Work Entries"].append(work_entry)
                            
                            print(f"    WORK: {day_key}: {hours} hours", file=sys.stderr)
                    hours_extracted = True
                    break
        
        # Alternative approach: Look for individual hour values in the table
        if not hours_extracted:
            print(f"🔍 Trying alternative hour extraction method...", file=sys.stderr)
            lines = text.split('\n')
            days_line_idx = -1
            for i, line in enumerate(lines):
                if re.search(r'MON.*TUE.*WED.*THU.*FRI.*SAT.*SUN', line, re.IGNORECASE):
                    days_line_idx = i
                    print(f"    Found days header at line {i}: {line[:50]}...", file=sys.stderr)
                    break
            
            if days_line_idx >= 0:
                for line_offset in range(1, 10):
                    if days_line_idx + line_offset < len(lines):
                        line = lines[days_line_idx + line_offset]
                        hour_matches = re.findall(r'\b(\d+\.00|\d+\.\d+)\b', line)
                        
                        if len(hour_matches) >= 5:
                            print(f"    Found potential hour values in line: {line[:100]}...", file=sys.stderr)
                            
                            if start_date:
                                for i, hour_str in enumerate(hour_matches[:7]):
                                    current_date = start_date + datetime.timedelta(days=i)
                                    date_str = current_date.strftime('%m/%d/%Y')
                                    
                                    # Only create a work entry if the day is not a PTO day
                                    if date_str not in pto_dates:
                                        hours = float(hour_str)
                                        if hours > 0:
                                            day_key = f"{days_of_week[i]} {date_str}"
                                            results["Daily Hours"][day_key] = hours
                                            work_entry = {
                                                "date": date_str,
                                                "day": days_of_week[i],
                                                "hours": hours,
                                                "activity": "Work"
                                            }
                                            results["Work Entries"].append(work_entry)
                                            print(f"    WORK: {day_key}: {hours} hours", file=sys.stderr)
                            hours_extracted = True
                            break
        
        # --- FIX ENDS HERE ---
        
        # Calculate total hours
        total_work = sum(h for h in results["Daily Hours"].values() if isinstance(h, (int, float)))
        total_pto = sum(entry["hours"] for entry in pto_entries) if pto_entries else 0
        results["Total Hours"] = total_work + total_pto
        print(f"📊 Total work hours: {total_work}, Total PTO: {total_pto}, Grand total: {results['Total Hours']}", file=sys.stderr)
        
        print(f"📋 Extraction complete. Found {len(results['Work Entries'])} work entries and {len(pto_entries)} PTO entries", file=sys.stderr)

    except Exception as e:
        print(f"❌ Error during timesheet parsing: {e}", file=sys.stderr)
    
    return results


def extract_timesheet_data(image_path):
    """
    Main function to extract timesheet data from an image using OCR Space API.
    Now returns structured data with activity classification.
    
    Args:
        image_path (str): The file path to the timesheet image.

    Returns:
        dict: A dictionary containing the extracted timesheet data with activity classification,
              or None if extraction fails.
    """
    try:
        print(f"🖼️ Processing timesheet image: {os.path.basename(image_path)}", file=sys.stderr)
        
        # Step 1: Extract text using OCR Space API
        text = extract_text_with_ocrspace(image_path)
        
        if not text.strip():
            print("⚠️ No text extracted from image", file=sys.stderr)
            return None
        
        # Step 2: Parse timesheet data from extracted text
        results = extract_timesheet_from_ocr_text(text, image_path)
        
        # Add activity summary for logging
        work_count = len(results.get("Work Entries", []))
        pto_count = len(results.get("PTO Data", []))
        print(f"🎯 Activity Summary: {work_count} work entries, {pto_count} PTO entries", file=sys.stderr)
        
        return results
        
    except Exception as e:
        print(f"❌ An error occurred during extraction: {e}", file=sys.stderr)
        return None


# Helper functions (keeping existing ones that are still needed)
def extract_pto_type(row):
    """Extract the type of PTO from the row data."""
    row_text = " ".join(str(cell) for cell in row).upper()
    if "LEAVE" in row_text:
        return "Leave"
    elif "PTO" in row_text:
        return "PTO"
    elif "VACATION" in row_text:
        return "Vacation"
    elif "SICK" in row_text:
        return "Sick Leave"
    else:
        return "Other"


def is_number(value):
    try:
        float(value)
        return True
    except ValueError:
        return False


def try_parse_hours(value):
    try:
        # Handle None values explicitly
        if value is None:
            return "N/A"
        # Convert to string and handle empty strings
        str_value = str(value).strip()
        if not str_value or str_value.lower() == 'none':
            return "N/A"
        # Try to parse as float, replacing comma with dot for decimal handling
        return float(str_value.replace(',', '.'))
    except (ValueError, TypeError, AttributeError):
        return "N/A"
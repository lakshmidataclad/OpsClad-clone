from PIL import Image
import pandas as pd
from collections import OrderedDict
import re
import datetime
import sys
import os
import requests
import json
from typing import Dict, Optional, List


def extract_text_with_ocrspace(image_path: str) -> str:
    """
    Extract text from image using OCR Space API.
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        str: Extracted text from the image
    """
    try:
        # Get OCR Space API key from environment
        ocr_api_key = os.getenv('OCR_KEY')
        if not ocr_api_key:
            raise ValueError("OCR_KEY environment variable is required")
        
        print(f"🔍 Using OCR Space API to extract text from: {os.path.basename(image_path)}", file=sys.stderr)
        
        # OCR Space API endpoint
        url = "https://api.ocr.space/parse/image"
        
        # Prepare the payload
        payload = {
            'apikey': ocr_api_key,
            'language': 'eng',
            'isOverlayRequired': 'false',
            'detectOrientation': 'false',
            'isTable': 'true',  # Enable table detection for better structured data extraction
            'scale': 'true',    # Auto-scale for better OCR
            'OCREngine': '2'    # Use OCR Engine 2 for better accuracy
        }
        
        # Open and send the image file
        with open(image_path, 'rb') as image_file:
            files = {'file': image_file}
            
            print(f"📡 Sending request to OCR Space API...", file=sys.stderr)
            response = requests.post(url, files=files, data=payload, timeout=30)
            
            if response.status_code != 200:
                raise Exception(f"OCR Space API returned status code {response.status_code}: {response.text}")
            
            result = response.json()
            
            # Check if OCR was successful
            if result.get('OCRExitCode') != 1:
                error_msg = result.get('ErrorMessage', ['Unknown error'])
                raise Exception(f"OCR failed: {error_msg}")
            
            # Extract text from results
            parsed_results = result.get('ParsedResults', [])
            if not parsed_results:
                raise Exception("No parsed results returned from OCR")
            
            extracted_text = parsed_results[0].get('ParsedText', '')
            
            if not extracted_text.strip():
                raise Exception("No text was extracted from the image")
            
            print(f"✅ OCR extraction successful. Text length: {len(extracted_text)} characters", file=sys.stderr)
            
            # Show a preview of extracted text for debugging
            preview = extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text
            print(f"📝 OCR Preview:\n{preview}", file=sys.stderr)
            
            return extracted_text
            
    except Exception as e:
        print(f"❌ Error during OCR extraction: {e}", file=sys.stderr)
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
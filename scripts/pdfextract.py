import re
import os
import sys
import datetime
from typing import List, Dict, Optional

import fitz  # PyMuPDF for PDF text extraction
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def get_supabase_client() -> Client:
    """Initialize and return Supabase client"""
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError("Supabase credentials not found in environment variables")

    return create_client(url, key)


def get_pto_hours_from_db(employee_id: str, project: str, client: str) -> float:
    """
    Fetch PTO hours from Supabase projects table based on employee_id, project, and client.
    """
    try:
        supabase = get_supabase_client()

        print(
            f"   🔍 Searching for project with: employee_id='{employee_id}', "
            f"project='{project}', client='{client}'",
            file=sys.stderr,
        )

        response = (
            supabase.table("projects")
            .select("hours")
            .eq("employee_id", employee_id)
            .eq("project", project)
            .eq("client", client)
            .execute()
        )

        if response.data and len(response.data) > 0:
            hours = response.data[0].get("hours", 8.0)
            print(
                f"   ✅ Found PTO hours from DB: {hours} for employee {employee_id}",
                file=sys.stderr,
            )
            return float(hours)
        else:
            print(
                "   ⚠️ No matching project found in DB. Using default 8.0 hours",
                file=sys.stderr,
            )
            return 8.0

    except Exception as e:
        print(
            f"   ❌ Error fetching PTO hours from database: {e}. Using default 8.0 hours",
            file=sys.stderr,
        )
        return 8.0


def get_employee_info_from_db(sender_email: str) -> Dict[str, str]:
    """Fetch employee name and ID from Supabase employees table using the sender's email."""
    try:
        supabase = get_supabase_client()
        print(
            f"   🔍 Searching for employee info for email: {sender_email}",
            file=sys.stderr,
        )

        response = (
            supabase.table("employees")
            .select("name, employee_id")
            .eq("email_id", sender_email)
            .execute()
        )

        if response.data and len(response.data) > 0:
            employee_data = response.data[0]
            print("   ✅ Found employee info in the database.", file=sys.stderr)
            return {
                "employee_name": employee_data.get("name"),
                "employee_number": employee_data.get("employee_id"),
            }
        else:
            print(
                "   ⚠️ No matching employee found in DB. Returning empty info.",
                file=sys.stderr,
            )
            return {}

    except Exception as e:
        print(
            f"   ❌ Error fetching employee info from database: {e}. Returning empty info.",
            file=sys.stderr,
        )
        return {}


def extract_text_from_pdf_fast(pdf_path: str) -> str:
    """Extract all text from a PDF using PyMuPDF's built-in text extraction."""
    text = ""
    try:
        print(
            f"📄 Extracting text from '{pdf_path}' using direct text extraction...",
            file=sys.stderr,
        )

        doc = fitz.open(pdf_path)

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            text += page_text + "\n"

            print(f"   Processed Page {page_num + 1}", file=sys.stderr)
            print("   --- Text Snippet ---", file=sys.stderr)
            print(
                page_text[:500] + "..."
                if len(page_text) > 500
                else page_text.strip(),
                file=sys.stderr,
            )
            print("   -------------------", file=sys.stderr)

        doc.close()
        print("✅ Text extraction complete.", file=sys.stderr)

    except Exception as e:
        print(f"❌ Error during text extraction: {e}", file=sys.stderr)
        return ""

    return text


def extract_client_name(timesheet_text: str) -> Optional[str]:
    """Extracts the client name from the timesheet text."""
    pattern = re.compile(
        r"Paradigm\s+Technology\s+Consulting\s+LLC", re.IGNORECASE | re.DOTALL
    )
    match = pattern.search(timesheet_text)
    if match:
        return "Paradigm Technology Consulting LLC"
    return None


def extract_timesheet_entries(
    timesheet_text: str, client_name: Optional[str] = None
) -> Dict[str, List[Dict[str, str]]]:
    """
    Extracts date, day, and hours from the timesheet text for both Work and PTO entries.
    Handles cases where PTO is logged as `PTO Mon 03/31/2025`.
    """
    work_entries = []
    pto_entries = []

    work_pattern = re.compile(
        r"(\d{2}/\d{2}/\d{4})\s+"
        r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+"
        r"Work\s+"
        r"(\d{1,2}:\d{2}\s*(?:AM|PM))\s+"
        r"(\d{1,2}:\d{2}\s*(?:AM|PM))\s+"
        r"[\d.]+\s+"
        r"[\d.]+\s+"
        r"[\d.]+\s+"
        r"[\d.]+\s+"
        r"[\d.]+\s+"
        r"([\d.]+)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL
    )

    alt_work_pattern = re.compile(
        r"([\d.]+)\s*"                              # Paid (first number in block)
        r"[\d.]+\s*"                                # Skip OT1
        r"[\d.]+\s*"                                # Skip OT2
        r"(?:(?:\d{1,2}:\d{2}\s*(?:AM|PM))\s*)" # Skip Start time
        r"(?:(?:\d{1,2}:\d{2}\s*(?:AM|PM))\s*)" # Skip Stop time
        r"Work\s*"
        r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*"
        r"(\d{2}/\d{2}/\d{4})",
        re.IGNORECASE
    )

    pto_pattern = re.compile(
        r"PTO\s*"
        r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*"
        r"(\d{2}/\d{2}/\d{4})",
        re.IGNORECASE,
    )

    # Work entries
    for match in work_pattern.finditer(timesheet_text):
        raw_date, raw_day, start_time, stop_time, hours = match.groups()

        try:
            date_obj = datetime.datetime.strptime(raw_date, "%m/%d/%Y").date()
            formatted_date = date_obj.strftime("%m/%d/%Y")
        except ValueError:
            formatted_date = raw_date

        entry = {
            "date": formatted_date,
            "day": raw_day.upper(),
            "start_time": start_time,
            "stop_time": stop_time,
            "hours": float(hours),
            "activity": "Work",
        }
        if client_name:
            entry["client"] = client_name
        work_entries.append(entry)
        print(
            f"   📝 Work entry: {formatted_date} ({raw_day}) - {hours} hours",
            file=sys.stderr,
        )

    # Alt work entries
    if not work_entries:
        for match in alt_work_pattern.finditer(timesheet_text):
            # Update to match the new capturing groups
            paid_hours, raw_day, raw_date = match.groups()

            try:
                date_obj = datetime.datetime.strptime(raw_date, "%m/%d/%Y").date()
                formatted_date = date_obj.strftime("%m/%d/%Y")
            except ValueError:
                formatted_date = raw_date
            
            # Hours are now directly extracted, no calculation needed
            hours_worked = float(paid_hours)

            entry = {
                "date": formatted_date,
                "day": raw_day.upper(),
                # "start_time" and "stop_time" are no longer captured by the regex
                "hours": hours_worked,
                "activity": "Work",
            }
            if client_name:
                entry["client"] = client_name
            work_entries.append(entry)
            print(
                f"   📝 Work entry (alt pattern): {formatted_date} ({raw_day}) - {hours_worked} hours",
                file=sys.stderr,
            )

    # PTO entries
    for match in pto_pattern.finditer(timesheet_text):
        raw_day, raw_date = match.groups()
        try:
            date_obj = datetime.datetime.strptime(raw_date, "%m/%d/%Y").date()
            formatted_date = date_obj.strftime("%m/%d/%Y")
        except ValueError:
            formatted_date = raw_date

        entry = {"date": formatted_date, "day": raw_day.upper(), "activity": "PTO"}
        if client_name:
            entry["client"] = client_name
        pto_entries.append(entry)
        print(
            f"   🏖️ PTO entry identified from PDF: {formatted_date} ({raw_day})",
            file=sys.stderr,
        )

    return {"work_entries": work_entries, "pto_entries": pto_entries}


def process_timesheet_pdf(
    pdf_path: str, sender_email: str = "farah.dataclad@gmail.com"
) -> Dict:
    """Main function to process a timesheet PDF and extract all relevant data."""
    print(f"🚀 Processing timesheet PDF: {pdf_path}", file=sys.stderr)
    text = extract_text_from_pdf_fast(pdf_path)

    if not text:
        print("❌ No text extracted from PDF", file=sys.stderr)
        return {}

    employee_info = get_employee_info_from_db(sender_email)
    print(f"👤 Employee Info: {employee_info}", file=sys.stderr)

    client_name = extract_client_name(text)
    print(f"🏢 Client: {client_name}", file=sys.stderr)

    entries = extract_timesheet_entries(text, client_name)

    if entries["pto_entries"] and employee_info.get("employee_number"):
        for pto_entry in entries["pto_entries"]:
            pto_hours = get_pto_hours_from_db(
                employee_info["employee_number"], "PTO", client_name or "Unknown"
            )
            pto_entry["hours"] = pto_hours
            pto_entry["employee_name"] = employee_info.get("employee_name")
            pto_entry["employee_id"] = employee_info.get("employee_number")
            pto_entry["sender_email"] = sender_email
            print(
                f"   🕐 Set PTO hours for {pto_entry['date']}: {pto_hours} (pulled from DB)",
                file=sys.stderr,
            )
    else:
        for pto_entry in entries["pto_entries"]:
            pto_entry["hours"] = 8.0
            print(
                f"   🕐 Set default PTO hours for {pto_entry['date']}: 8.0",
                file=sys.stderr,
            )

    work_count = len(entries["work_entries"])
    pto_count = len(entries["pto_entries"])

    print("✅ Processing complete:", file=sys.stderr)
    print(f"   📝 Work entries: {work_count} (activity: 'work')", file=sys.stderr)
    print(f"   🏖️ PTO entries: {pto_count} (activity: 'pto')", file=sys.stderr)

    return {
        "employee_info": employee_info,
        "client_name": client_name,
        "work_entries": entries["work_entries"],
        "pto_entries": entries["pto_entries"],
        "extracted_text": text,
        "summary": {
            "work_entries": work_count,
            "pto_entries": pto_count,
            "total_entries": work_count + pto_count,
        },
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python pdfextract.py <path_to_pdf>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]

    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    result = process_timesheet_pdf(pdf_path)

    print("\n" + "=" * 60)
    print("EXTRACTION RESULTS WITH ACTIVITY CLASSIFICATION")
    print("=" * 60)

    if result.get("employee_info"):
        print(f"Employee: {result['employee_info'].get('employee_name', 'N/A')}")
        print(f"Employee #: {result['employee_info'].get('employee_number', 'N/A')}")

    print(
        f"\n📝 WORK ENTRIES ({len(result.get('work_entries', []))}) - Activity: 'work':"
    )
    for entry in result.get("work_entries", []):
        print(
            f"  {entry['date']} ({entry['day']}): {entry['hours']} hours [Activity: {entry.get('activity', 'work')}]"
        )

    print(
        f"\n🏖️ PTO ENTRIES ({len(result.get('pto_entries', []))}) - Activity: 'pto':"
    )
    for entry in result.get("pto_entries", []):
        hours_info = entry.get("hours", "N/A")
        print(
            f"  {entry['date']} ({entry['day']}): {hours_info} hours [Activity: {entry.get('activity', 'pto')}]"
        )

    if result.get("summary"):
        summary = result["summary"]
        print("\n📊 SUMMARY:")
        print(f"  Work entries: {summary['work_entries']}")
        print(f"  PTO entries: {summary['pto_entries']}")
        print(f"  Total entries: {summary['total_entries']}")

    print("\n✅ All entries are properly classified with activity types!")
    print("   - Work entries will be saved to timesheet_entries table with activity='work'")
    print(
        "   - PTO entries will be saved to both timesheet_entries (activity='pto') "
        "and pto_records tables"
    )

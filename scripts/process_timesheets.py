#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main script to process timesheet extraction using the provided Python modules.
This script integrates gmailconnector.py, pdfextract.py, pngextract.py, and excelextract.py
Updated to include activity column and proper PTO handling, now with Excel support.
"""

import sys
import json
import os
from datetime import datetime, timedelta
import traceback
import uuid  # For generating unique unique IDs
from supabase import create_client, Client

# Configure encoding
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Custom module imports
from gmailconnector import GmailTimesheetDetector
from pdfextract import process_timesheet_pdf  # Updated import
from pngextract import extract_timesheet_data  # Now uses PNG-to-PDF approach
from excelextract import extract_timesheet_data_from_excel, validate_excel_timesheet  # New Excel import


def get_supabase_client():
    """Initialize and return Supabase client"""
    try:
        # Get Supabase credentials from environment variables
        supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        return supabase
    except Exception as e:
        print(f"Error initializing Supabase client: {e}", file=sys.stderr)
        return None


def save_timesheet_entries_to_supabase(entries, table_name="timesheet_entries"):
    """
    Save timesheet entries to Supabase with activity column
    
    Args:
        entries: List of timesheet entries with activity field
        table_name: Name of the table to save to
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            print(f"Failed to initialize Supabase client for {table_name}", file=sys.stderr)
            return False

        if not entries:
            print(f"No entries to save to {table_name}", file=sys.stderr)
            return True

        # Insert records into Supabase
        result = supabase.table(table_name).insert(entries).execute()
        
        if result.data:
            print(f"✅ Successfully saved {len(entries)} entries to {table_name}", file=sys.stderr)
            for entry in entries:
                activity = entry.get('activity', 'unknown')
                print(f"   {activity.upper()}: {entry.get('employee_name')} - {entry.get('date')} ({entry.get('day')}) - {entry.get('hours')} hours", file=sys.stderr)
            return True
        else:
            print(f"⚠️ No data returned from Supabase insert operation for {table_name}", file=sys.stderr)
            return False
        
    except Exception as e:
        print(f"❌ Error saving entries to {table_name}: {e}", file=sys.stderr)
        return False


def save_pto_data_to_supabase(file_path, pto_entries, start_date, employee_name, employee_id, sender_email):
    """Save PTO data directly to Supabase pto_records table"""
    try:
        supabase = get_supabase_client()
        if not supabase:
            print("Failed to initialize Supabase client - falling back to local file storage", file=sys.stderr)
            save_pto_data_to_file(file_path, pto_entries, start_date, employee_name, employee_id, sender_email)
            return

        # Prepare PTO records for Supabase insertion
        pto_records_for_db = []
        for entry in pto_entries:
            # Convert date to proper format for database
            date_str = entry.get("date")
            formatted_date = None
            if date_str:
                try:
                    # Try to parse the date and convert to ISO format
                    if isinstance(date_str, str):
                        # Handle MM/DD/YYYY format
                        parsed_date = datetime.strptime(date_str, '%m/%d/%Y')
                        formatted_date = parsed_date.strftime('%Y-%m-%d')
                    else:
                        formatted_date = str(date_str)
                except ValueError:
                    # If parsing fails, use the original string
                    formatted_date = str(date_str)
            
            pto_record = {
                "date": formatted_date,
                "day": entry.get("day"),
                "hours": entry.get("hours"),
                "employee_name": employee_name,
                "employee_id": employee_id,
                "sender_email": sender_email,
                "created_at": datetime.now().isoformat(),
                "activity": "PTO"  # Add activity column
            }
            pto_records_for_db.append(pto_record)

        # Insert records into Supabase
        if pto_records_for_db:
            result = supabase.table('pto_records').insert(pto_records_for_db).execute()
            
            if result.data:
                print(f"✅ Successfully saved {len(pto_records_for_db)} PTO records to Supabase", file=sys.stderr)
                for record in pto_records_for_db:
                    print(f"   PTO: {record['employee_name']} - {record['date']} ({record['day']}) - {record['hours']} hours", file=sys.stderr)
            else:
                print(f"⚠️ No data returned from Supabase insert operation", file=sys.stderr)
        
    except Exception as e:
        print(f"❌ Error saving PTO data to Supabase: {e}", file=sys.stderr)
        print(f"🔄 Falling back to local file storage", file=sys.stderr)
        # Fallback to file storage if Supabase fails
        save_pto_data_to_file(file_path, pto_entries, start_date, employee_name, employee_id, sender_email)


def save_pto_data_to_file(file_path, pto_entries, start_date, employee_name, employee_id, sender_email):
    """Fallback function to save PTO data to local JSON file"""
    try:
        # Create PTO data directory if it doesn't exist
        pto_dir = "pto_records"
        if not os.path.exists(pto_dir):
            os.makedirs(pto_dir)
        
        # Generate filename based on file path and date
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        week_str = start_date.strftime('%Y-%m-%d') if start_date else datetime.now().strftime('%Y-%m-%d')
        pto_filename = f"{base_name}_{week_str}_pto.json"
        pto_filepath = os.path.join(pto_dir, pto_filename)
        
        # Prepare PTO records with desired fields
        formatted_pto_records = []
        for entry in pto_entries:
            formatted_pto_records.append({
                "date": entry.get("date"),
                "day": entry.get("day"),
                "hours": entry.get("hours"),
                "employee_name": employee_name,
                "employee_id": employee_id,
                "sender_email": sender_email,
                "activity": "PTO"  # Add activity column
            })
        
        # Save to file
        with open(pto_filepath, 'w') as f:
            json.dump(formatted_pto_records, f, indent=2)
        
        print(f"📁 PTO data saved to local file: {pto_filepath}", file=sys.stderr)
        
    except Exception as e:
        print(f"❌ Error saving PTO data to file: {e}", file=sys.stderr)


def process_timesheet_extraction(gmail_email, gmail_password, start_date, end_date, sender_filter=None, employee_mapping=None):
    """
    Main function to process timesheet extraction

    Args:
        gmail_email: Gmail address
        gmail_password: Gmail app password
        start_date: Start date for search (string, datetime, or None) - now mandatory
        end_date: End date for search (string, datetime, or None) - now mandatory
        sender_filter: Optional email sender filter
        employee_mapping: Employee mapping dictionary
    """
    results = {
        "success": False,
        "message": "",
        "extracted_data": [],
        "total_entries": 0,
        "errors": []
    }

    try:
        print(f"🚀 Starting timesheet extraction for {gmail_email}", file=sys.stderr)

        detector = GmailTimesheetDetector(gmail_email, gmail_password)

        if not detector.connect():
            results["message"] = "Failed to connect to Gmail"
            print(f"❌ {results['message']}", file=sys.stderr)
            return results

        # Always use date range
        print(f"🔍 Searching for timesheet emails from {start_date} to {end_date}...", file=sys.stderr)
        if sender_filter:
            print(f"📧 Filtering by sender: {sender_filter}", file=sys.stderr)
        timesheet_emails = detector.find_timesheet_emails(start_date, end_date, sender_filter)

        if not timesheet_emails:
            results["message"] = "No timesheet emails found in the specified time range"
            print(f"⚠️ {results['message']}", file=sys.stderr)
            detector.disconnect()
            return results

        print(f"📧 Found {len(timesheet_emails)} timesheet emails", file=sys.stderr)

        download_dir = "timesheet_attachments"
        os.makedirs(download_dir, exist_ok=True)

        all_extracted_data = []

        for email_info in timesheet_emails:
            print(f"\n📧 Processing email: {email_info.subject}", file=sys.stderr)
            print(f"   From: {email_info.sender}", file=sys.stderr)
            print(f"   Date: {email_info.date}", file=sys.stderr)

            downloaded_files = detector.download_attachments(email_info, download_dir)

            if not downloaded_files:
                print("    ⚠️ No attachments downloaded", file=sys.stderr)
                continue

            for file_path in downloaded_files:
                print(f"    📎 Processing attachment: {os.path.basename(file_path)}", file=sys.stderr)

                try:
                    file_extension = os.path.splitext(file_path)[1].lower()

                    if file_extension == '.pdf':
                        extracted_data = process_pdf_timesheet(file_path, email_info, employee_mapping)
                    elif file_extension in ['.png', '.jpg', '.jpeg']:
                        extracted_data = process_image_timesheet(file_path, email_info, employee_mapping)
                    elif file_extension in ['.xlsx', '.xls']:
                        extracted_data = process_excel_timesheet(file_path, email_info, employee_mapping)
                    else:
                        print(f"    ⚠️ Unsupported file type: {file_extension}", file=sys.stderr)
                        continue

                    if extracted_data:
                        all_extracted_data.extend(extracted_data)
                        print(f"    ✅ Extracted {len(extracted_data)} entries", file=sys.stderr)
                    else:
                        print(f"    ⚠️ No data extracted from {os.path.basename(file_path)}", file=sys.stderr)

                except Exception as e:
                    error_msg = f"Error processing {os.path.basename(file_path)}: {str(e)}"
                    print(f"    ❌ {error_msg}", file=sys.stderr)
                    results["errors"].append(error_msg)

        detector.disconnect()

        results["success"] = True
        results["extracted_data"] = all_extracted_data
        results["total_entries"] = len(all_extracted_data)

        results["message"] = f"Successfully extracted {len(all_extracted_data)} timesheet entries from {len(timesheet_emails)} emails (date range: {start_date} to {end_date})"

        print(f"\n✅ Extraction complete! Total entries: {len(all_extracted_data)}", file=sys.stderr)

    except Exception as e:
        error_msg = f"Extraction failed: {str(e)}"
        print(f"❌ {error_msg}", file=sys.stderr)
        print(f"🔍 Full traceback:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        results["message"] = error_msg
        results["errors"].append(traceback.format_exc())

    return results


def process_excel_timesheet(excel_path, email_info, employee_mapping):
    """Process Excel timesheet file (.xlsx or .xls)"""
    extracted_data = []
    entries_for_db = []  # Combined entries for database storage

    try:
        print(f"    📊 Processing Excel file...", file=sys.stderr)
        
        # First validate if it's a timesheet
        if not validate_excel_timesheet(excel_path):
            print(f"    ⚠️ File doesn't appear to be a timesheet Excel file", file=sys.stderr)
            return extracted_data

        # Use the Excel extraction function
        excel_results = extract_timesheet_data_from_excel(excel_path)

        if not excel_results:
            print(f"    ⚠️ No data extracted from Excel file", file=sys.stderr)
            return extracted_data

        # Extract information from the structure
        client_name = excel_results.get('client_name', 'Unknown Client')
        work_entries = excel_results.get('work_entries', [])
        pto_entries = excel_results.get('pto_entries', [])

        sender_email = email_info.sender
        
        # Get employee information from mapping
        employee_name = get_employee_name(sender_email, employee_mapping)
        employee_id = get_employee_id(sender_email, employee_mapping)
        
        # For Excel files, we might need to determine project from client mapping
        project_name = get_employee_project(sender_email, client_name, employee_mapping)

        print(f"    📋 Client: {client_name}", file=sys.stderr)
        print(f"    🏢 Project: {project_name}", file=sys.stderr)
        print(f"    👤 Employee: {employee_name} ({employee_id})", file=sys.stderr)

        # Process work entries
        for entry in work_entries:
            work_data = {
                "date": entry["date"],
                "day": entry["day"],
                "hours": entry["hours"],
                "client": entry.get("client", client_name),
                "project": entry.get("project", project_name),
                "employee_name": employee_name,
                "employee_id": employee_id,
                "sender_email": clean_email(sender_email),
                "activity": "WORK",  # Add activity column
                "created_at": datetime.now().isoformat()
            }
            extracted_data.append(work_data)
            entries_for_db.append(work_data)

        # Process PTO entries
        for entry in pto_entries:
            pto_data = {
                "date": entry["date"],
                "day": entry["day"],
                "hours": entry.get("hours", 8.0),
                "client": entry.get("client", client_name),
                "project": entry.get("project", project_name),
                "employee_name": employee_name,
                "employee_id": employee_id,
                "sender_email": clean_email(sender_email),
                "activity": "PTO",  # Add activity column
                "created_at": datetime.now().isoformat()
            }
            #extracted_data.append(pto_data)
            #entries_for_db.append(pto_data)

        # Save all entries to main timesheet table with activity column
        if entries_for_db:
            save_timesheet_entries_to_supabase(entries_for_db, "timesheet_entries")

        # Save PTO entries to dedicated PTO table
        if pto_entries:
            # Determine start_date from the entries
            start_date = None
            if pto_entries:
                try:
                    start_date = datetime.strptime(pto_entries[0]["date"], '%m/%d/%Y').date()
                except ValueError:
                    start_date = datetime.now().date()
            
            #save_pto_data_to_supabase(excel_path, pto_entries, start_date, employee_name, employee_id, clean_email(sender_email))

        print(f"    ✅ Processed {len(work_entries)} work entries and {len(pto_entries)} PTO entries from Excel", file=sys.stderr)

    except Exception as e:
        print(f"    ❌ Error processing Excel file: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

    return extracted_data


def process_pdf_timesheet(pdf_path, email_info, employee_mapping):
    """Process PDF timesheet file using the enhanced extraction"""
    extracted_data = []
    entries_for_db = []  # Combined entries for database storage

    try:
        # Use the existing process_timesheet_pdf function
        pdf_results = process_timesheet_pdf(pdf_path)

        if not pdf_results:
            print(f"    ⚠️ No data extracted from PDF", file=sys.stderr)
            return extracted_data

        # Extract information from the structure
        employee_info = pdf_results.get('employee_info', {})
        client_name = pdf_results.get('client_name')
        work_entries = pdf_results.get('work_entries', [])
        pto_entries = pdf_results.get('pto_entries', [])

        sender_email = email_info.sender
        
        # Get employee information, preferring from PDF but falling back to mapping
        employee_name = employee_info.get('employee_name') or get_employee_name(sender_email, employee_mapping)
        employee_id = employee_info.get('employee_number') or get_employee_id(sender_email, employee_mapping)
        project_name = get_employee_project(sender_email, client_name, employee_mapping)

        # Process work entries
        for entry in work_entries:
            work_data = {
                "date": entry["date"],
                "day": entry["day"],
                "hours": entry["hours"],
                "client": entry.get("client", client_name),
                "project": project_name,
                "employee_name": employee_name,
                "employee_id": employee_id,
                "sender_email": clean_email(sender_email),
                "activity": "WORK",  # Add activity column
                "created_at": datetime.now().isoformat()
            }
            extracted_data.append(work_data)
            entries_for_db.append(work_data)

        # Process PTO entries
        for entry in pto_entries:
            pto_data = {
                "date": entry["date"],
                "day": entry["day"],
                "hours": entry.get("hours", 8.0),
                "client": entry.get("client", client_name),
                "project": project_name,
                "employee_name": employee_name,
                "employee_id": employee_id,
                "sender_email": clean_email(sender_email),
                "activity": "PTO",  # Add activity column
                "created_at": datetime.now().isoformat()
            }
            #extracted_data.append(pto_data)
            #entries_for_db.append(pto_data)

        # Save all entries to main timesheet table with activity column
        if entries_for_db:
            save_timesheet_entries_to_supabase(entries_for_db, "timesheet_entries")

        # Save PTO entries to dedicated PTO table
        if pto_entries:
            # Determine start_date from the entries
            start_date = None
            if pto_entries:
                try:
                    start_date = datetime.strptime(pto_entries[0]["date"], '%m/%d/%Y').date()
                except ValueError:
                    start_date = datetime.now().date()
            
            #save_pto_data_to_supabase(pdf_path, pto_entries, start_date, employee_name, employee_id, clean_email(sender_email))

    except Exception as e:
        print(f"    ❌ Error processing PDF: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

    return extracted_data


def process_image_timesheet(image_path, email_info, employee_mapping):
    """
    Process image timesheet file using the new PNG-to-PDF approach.
    Updated to work with the modified pngextract.py and include activity column
    """
    extracted_data = []
    entries_for_db = []  # Combined entries for database storage

    try:
        print(f"    🖼️ Processing image using PNG-to-PDF approach...", file=sys.stderr)
        
        # Use the modified extract_timesheet_data function (now PNG-to-PDF based)
        timesheet_ocr_results = extract_timesheet_data(image_path)

        if not timesheet_ocr_results:
            print(f"    ⚠️ No data extracted from image", file=sys.stderr)
            return extracted_data
        
        print(f"DEBUG: Employee Mapping in process_image_timesheet: {employee_mapping}", file=sys.stderr)
        
        sender_email = email_info.sender
        employee_name = get_employee_name(sender_email, employee_mapping)
        employee_id = get_employee_id(sender_email, employee_mapping)
        project_name = timesheet_ocr_results.get("Select Project", "Unknown Project")
        client_name = get_client_from_project(project_name, employee_mapping)
        daily_hours = timesheet_ocr_results.get("Daily Hours", {})

        print(f"    📋 Extracted project: {project_name}", file=sys.stderr)
        print(f"    🏢 Mapped client: {client_name}", file=sys.stderr)
        print(f"    👤 Employee: {employee_name} ({employee_id})", file=sys.stderr)

        # Handle PTO data separately - save to both tables
        pto_data = timesheet_ocr_results.get("PTO Data")
        if pto_data:
            start_date = timesheet_ocr_results.get("start_date")
            print(f"    🏖️ Found {len(pto_data)} PTO entries, saving to database...", file=sys.stderr)
            
            # Save to dedicated PTO table
            # save_pto_data_to_supabase(image_path, pto_data, start_date, employee_name, employee_id, clean_email(sender_email))
            
            # Also add to main entries for combined tracking
            for pto_entry in pto_data:
                pto_main_data = {
                    "date": pto_entry["date"],
                    "day": pto_entry["day"],
                    "hours": pto_entry["hours"],
                    "client": client_name,
                    "project": project_name,
                    "employee_name": employee_name,
                    "employee_id": employee_id,
                    "sender_email": clean_email(sender_email),
                    "activity": "PTO",  # Add activity column
                    "created_at": datetime.now().isoformat()
                }
                #extracted_data.append(pto_main_data)
                #entries_for_db.append(pto_main_data)

        # Process regular daily hours
        for day_date_key, hours in daily_hours.items():
            if hours != "N/A" and hours > 0:
                parts = day_date_key.split()
                day = parts[0] if parts else "Unknown"
                date = parts[1] if len(parts) > 1 else ""

                work_data = {
                    "date": date,
                    "day": day,
                    "hours": float(hours),
                    "client": client_name,
                    "project": project_name,
                    "employee_name": employee_name,
                    "employee_id": employee_id,
                    "sender_email": clean_email(sender_email),
                    "activity": "WORK",  # Add activity column
                    "created_at": datetime.now().isoformat()
                }
                extracted_data.append(work_data)
                entries_for_db.append(work_data)

        # Save all entries to main timesheet table with activity column
        if entries_for_db:
            save_timesheet_entries_to_supabase(entries_for_db, "timesheet_entries")

        print(f"    ✅ Processed {len([e for e in extracted_data if e['activity'] == 'WORK'])} work entries and {len([e for e in extracted_data if e['activity'] == 'PTO'])} PTO entries", file=sys.stderr)

    except Exception as e:
        print(f"    ❌ Error processing image: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

    return extracted_data


def get_employee_name(sender_email, employee_mapping):
    """Get employee name from email mapping"""
    if not employee_mapping:
        return sender_email.split('@')[0]

    clean_sender = clean_email(sender_email)
    return employee_mapping.get(clean_sender, {}).get("name", clean_sender)

def get_employee_id(sender_email, employee_mapping):
    """Get employee id from email mapping"""
    if not employee_mapping:
        return sender_email.split('@')[0]

    clean_sender = clean_email(sender_email)
    # Try both possible keys for backward compatibility
    employee_info = employee_mapping.get(clean_sender, {})

    # First try 'employee_id' (from database), then fall back to 'emp id' (from CSV header)
    employee_id = employee_info.get("employee_id") or employee_info.get("emp id")

    return employee_id if employee_id else clean_sender


def get_employee_project(sender_email, client_name, employee_mapping):
    """Get employee project from mapping"""
    if not employee_mapping or not client_name:
        return "Unknown Project"

    clean_sender = clean_email(sender_email)
    employee_info = employee_mapping.get(clean_sender, {})
    projects = employee_info.get("projects", {})

    client_key = client_name.lower().replace(" technology consulting llc", "").strip()
    return projects.get(client_key, "Unknown Project")


def get_client_from_project(project_name, employee_mapping):
    """Get client name from project name"""
    if not employee_mapping:
        return "Unknown Client"

    # Normalize the project name from the timesheet for comparison
    normalized_incoming_project_name = project_name.strip().lower()
    print(f"DEBUG get_client_from_project: Looking for project: '{normalized_incoming_project_name}'", file=sys.stderr)

    for employee_info in employee_mapping.values():
        projects_for_employee = employee_info.get("projects", {})
        print(f"DEBUG get_client_from_project: Checking employee projects: {projects_for_employee}", file=sys.stderr)

        for client_name_in_map_key, project_details in projects_for_employee.items():
            # Access the 'project' key from the project_details dictionary
            mapped_project_name = project_details.get('project')

            if mapped_project_name: # Ensure it's not None
                normalized_mapped_project_name = mapped_project_name.strip().lower()
                print(f"DEBUG get_client_from_project: Comparing mapped project '{normalized_mapped_project_name}' with incoming '{normalized_incoming_project_name}'", file=sys.stderr)

                if normalized_mapped_project_name == normalized_incoming_project_name:
                    # Return the client name from the map key, title-cased
                    return client_name_in_map_key.title()

    return "Unknown Client"


def clean_email(email_str):
    """Clean email address from angle brackets and extra formatting"""
    if '<' in email_str and '>' in email_str:
        return email_str[email_str.find('<') + 1:email_str.find('>')].strip().lower()
    return email_str.strip().lower()


def parse_date_input(date_str):
    """Helper function to parse date inputs from JSON"""
    if not date_str:
        return None

    if isinstance(date_str, str):
        # Handle string representations of None
        if date_str.lower() in ['none', 'null', '']:
            return None
        return date_str

    # Handle other formats that might come from frontend
    return str(date_str)


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file_path = None

    try:
        input_data = json.loads(sys.stdin.read())

        gmail_email = input_data.get("gmail_email")
        gmail_password = input_data.get("gmail_password")

        sender_filter = input_data.get("sender_filter")
        employee_mapping = input_data.get("employee_mapping", {})
        results_id = input_data.get("results_id")

        # New date range parameters - properly parse them
        start_date = parse_date_input(input_data.get("start_date"))
        end_date = parse_date_input(input_data.get("end_date"))

        if not results_id:
            print("❌ Error: Missing 'results_id' in input. Cannot determine output file.", file=sys.stderr)
            sys.exit(1)

        output_filename = f"timesheet_results_{results_id}.json"
        output_file_path = os.path.join(script_dir, output_filename)

        if not gmail_email or not gmail_password:
            error_message = "Gmail email and password are required"
            print(f"❌ Error: {error_message}", file=sys.stderr)
            try:
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "success": False,
                        "message": error_message,
                        "errors": ["Missing gmail_email or gmail_password in input"]
                    }, f)
            except IOError as file_err:
                print(f"❌ Could not write error results to {output_file_path}: {file_err}", file=sys.stderr)
            sys.exit(1)

        # Ensure start_date and end_date are always provided
        if not start_date or not end_date:
            error_message = "Start date and end date are required for extraction."
            print(f"❌ Error: {error_message}", file=sys.stderr)
            try:
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "success": False,
                        "message": error_message,
                        "errors": ["Missing start_date or end_date in input"]
                    }, f)
            except IOError as file_err:
                print(f"❌ Could not write error results to {output_file_path}: {file_err}", file=sys.stderr)
            sys.exit(1)


        print(f"📋 Input parameters:", file=sys.stderr)
        print(f"    Gmail: {gmail_email}", file=sys.stderr)
        print(f"    Start Date: {start_date}", file=sys.stderr)
        print(f"    End Date: {end_date}", file=sys.stderr)
        print(f"    Sender Filter: {sender_filter}", file=sys.stderr)

        print(f"🗓️ Using date range mode: {start_date} to {end_date}", file=sys.stderr)
        print(f"🖼️ Image processing: PNG-to-PDF conversion approach", file=sys.stderr)

        results = process_timesheet_extraction(
            gmail_email,
            gmail_password,
            start_date,
            end_date,
            sender_filter,
            employee_mapping
        )

        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, default=str, indent=2)

        print(f"✅ Results written to: {output_file_path}", file=sys.stderr)

    except Exception as e:
        error_msg = f"Script error: {str(e)}"
        print(f"❌ Top-level script error: {error_msg}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

        if output_file_path:
            try:
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    json.dump({
                        "success": False,
                        "message": error_msg,
                        "errors": [traceback.format_exc()]
                    }, f, default=str, indent=2)
                print(f"❌ Error results also written to: {output_file_path}", file=sys.stderr)
            except IOError as file_err:
                print(f"❌ Could not write error results to {output_file_path}: {file_err}", file=sys.stderr)

        sys.exit(1)
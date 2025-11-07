#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel timesheet extraction module
Processes .xlsx and .xls timesheet files and extracts timesheet data
"""

import sys
import os
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
import traceback

def extract_timesheet_data_from_excel(excel_path: str) -> Dict[str, Any]:
    """
    Extract timesheet data from Excel file (.xlsx or .xls)
    
    Args:
        excel_path: Path to the Excel file
        
    Returns:
        Dictionary containing extracted timesheet data
    """
    try:
        print(f"📊 Starting Excel extraction from: {os.path.basename(excel_path)}", file=sys.stderr)
        
        # Read Excel file - try different sheet scenarios
        try:
            # First, try to read the first sheet
            df = pd.read_excel(excel_path, sheet_name=0)
        except Exception as e:
            print(f"❌ Error reading Excel file: {e}", file=sys.stderr)
            return None
        
        if df.empty:
            print("⚠️ Excel file appears to be empty", file=sys.stderr)
            return None
        
        print(f"📋 Excel file loaded: {len(df)} rows, {len(df.columns)} columns", file=sys.stderr)
        print(f"🏷️ Column headers: {list(df.columns)}", file=sys.stderr)
        
        # Normalize column names (handle case variations and extra spaces)
        df.columns = df.columns.str.strip().str.lower()
        
        # Map common column name variations
        column_mapping = {
            'date': ['date', 'day_date', 'work_date'],
            'day': ['day', 'day_of_week', 'weekday'],
            'client': ['client', 'client_name', 'company'],
            'project': ['project', 'project_name'],
            'activity': ['activity', 'activity_type', 'work/pto', 'type', 'activity (work/pto)'],
            'hours': ['hours', 'hours_worked', 'time', 'duration']
        }
        
        # Find actual column names in the dataframe
        actual_columns = {}
        for standard_name, variations in column_mapping.items():
            for variation in variations:
                if variation in df.columns:
                    actual_columns[standard_name] = variation
                    break
        
        print(f"🔍 Mapped columns: {actual_columns}", file=sys.stderr)
        
        # Check if we have the required columns
        required_columns = ['date', 'hours']
        missing_columns = [col for col in required_columns if col not in actual_columns]
        
        if missing_columns:
            print(f"❌ Missing required columns: {missing_columns}", file=sys.stderr)
            print(f"📋 Available columns: {list(df.columns)}", file=sys.stderr)
            return None
        
        # Extract data using mapped column names
        extracted_data = {
            'work_entries': [],
            'pto_entries': [],
            'employee_info': {},
            'client_name': None,
            'total_hours': 0
        }
        
        # Process each row
        work_entries = []
        pto_entries = []
        total_hours = 0
        
        for index, row in df.iterrows():
            try:
                date_value = row[actual_columns['date']] if 'date' in actual_columns else None
                hours_value = row[actual_columns['hours']] if 'hours' in actual_columns else None

                # Check for and skip summary/total rows.
                if pd.isna(date_value) or pd.isna(hours_value) or str(date_value).lower() == 'total' or hours_value == 0:
                    continue
                
                # Extract basic information
                date_str = format_date(date_value)
                
                # Always re-format the day based on the date to ensure consistency
                day = get_day_from_date(date_str)
                
                client = str(row[actual_columns['client']]) if 'client' in actual_columns and not pd.isna(row[actual_columns['client']]) else "Unknown Client"
                project = str(row[actual_columns['project']]) if 'project' in actual_columns and not pd.isna(row[actual_columns['project']]) else "Unknown Project"
                
                # Clean up activity field
                activity = str(row[actual_columns['activity']]).upper().strip() if 'activity' in actual_columns and not pd.isna(row[actual_columns['activity']]) else "WORK"
                
                # Normalize the activity to 'PTO' or 'WORK'
                if 'PTO' in activity:
                    activity = 'PTO'
                else:
                    activity = 'WORK'
                
                hours = float(hours_value)
                
                entry_data = {
                    'date': date_str,
                    'day': day,
                    'client': client,
                    'project': project,
                    'hours': hours,
                    'activity': activity
                }
                
                # Separate work and PTO entries
                if activity == 'PTO':
                    pto_entries.append(entry_data)
                else:
                    work_entries.append(entry_data)
                
                total_hours += hours
                
                print(f"✅ Processed: {date_str} ({day}) - {activity} - {hours} hours - {client} - {project}", file=sys.stderr)
                
            except Exception as e:
                print(f"⚠️ Error processing row {index}: {e}", file=sys.stderr)
                continue
        
        # Set client name from first work entry if available
        client_name = work_entries[0]['client'] if work_entries else (pto_entries[0]['client'] if pto_entries else "Unknown Client")
        
        extracted_data.update({
            'work_entries': work_entries,
            'pto_entries': pto_entries,
            'client_name': client_name,
            'total_hours': total_hours
        })
        
        print(f"📊 Excel extraction complete:", file=sys.stderr)
        print(f"   Work entries: {len(work_entries)}", file=sys.stderr)
        print(f"   PTO entries: {len(pto_entries)}", file=sys.stderr)
        print(f"   Total hours: {total_hours}", file=sys.stderr)
        print(f"   Client: {client_name}", file=sys.stderr)
        
        return extracted_data
        
    except Exception as e:
        print(f"❌ Error extracting data from Excel file: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


def format_date(date_value: Union[str, datetime, pd.Timestamp]) -> str:
    """
    Format date value to MM/DD/YYYY string format
    
    Args:
        date_value: Date in various formats
        
    Returns:
        Formatted date string
    """
    try:
        if pd.isna(date_value):
            return ""
        
        # Handle datetime objects and timestamps
        if isinstance(date_value, (datetime, pd.Timestamp)):
            return date_value.strftime('%m/%d/%Y')
        
        # Handle string dates
        if isinstance(date_value, str):
            try:
                # Try to parse the string date and format it
                parsed_date = pd.to_datetime(date_value)
                return parsed_date.strftime('%m/%d/%Y')
            except:
                return str(date_value)  # Return as-is if parsing fails
        
        else:
            # Try to convert to datetime
            parsed_date = pd.to_datetime(date_value)
            return parsed_date.strftime('%m/%d/%Y')
            
    except Exception as e:
        print(f"⚠️ Error formatting date {date_value}: {e}", file=sys.stderr)
        return str(date_value) if date_value else ""


def get_day_from_date(date_str: str) -> str:
    """
    Get day name from date string
    
    Args:
        date_str: Date string in MM/DD/YYYY format
        
    Returns:
        Day name abbreviation (e.g., 'MON')
    """
    try:
        if not date_str:
            return "Unknown"
        
        # Parse the date and get day name
        date_obj = datetime.strptime(date_str, '%m/%d/%Y')
        return date_obj.strftime('%a').upper()  # Three-letter abbreviation in uppercase
        
    except Exception as e:
        print(f"⚠️ Error getting day from date {date_str}: {e}", file=sys.stderr)
        return "Unknown"


def validate_excel_timesheet(excel_path: str) -> bool:
    """
    Validate if the Excel file appears to be a timesheet
    
    Args:
        excel_path: Path to Excel file
        
    Returns:
        True if file appears to be a timesheet
    """
    try:
        df = pd.read_excel(excel_path, sheet_name=0, nrows=5)  # Read just first 5 rows
        
        if df.empty:
            return False
        
        # Check for timesheet-like columns
        columns_lower = [col.lower().strip() for col in df.columns]
        
        timesheet_indicators = ['date', 'hours', 'day', 'client', 'project', 'activity', 'time']
        
        matches = sum(1 for indicator in timesheet_indicators if any(indicator in col for col in columns_lower))
        
        # If we have at least 2 timesheet indicators, consider it a timesheet
        return matches >= 2
        
    except Exception as e:
        print(f"⚠️ Error validating Excel timesheet: {e}", file=sys.stderr)
        return False


# Test function
def test_excel_extraction():
    """Test function for Excel extraction"""
    test_file = "test_timesheet.xlsx"
    
    if os.path.exists(test_file):
        print(f"🧪 Testing Excel extraction with: {test_file}", file=sys.stderr)
        result = extract_timesheet_data_from_excel(test_file)
        
        if result:
            print("✅ Test successful!", file=sys.stderr)
            print(f"Work entries: {len(result['work_entries'])}", file=sys.stderr)
            print(f"PTO entries: {len(result['pto_entries'])}", file=sys.stderr)
        else:
            print("❌ Test failed!", file=sys.stderr)
    else:
        print(f"⚠️ Test file {test_file} not found", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        excel_file = sys.argv[1]
        if os.path.exists(excel_file):
            print(f"📊 Processing Excel file: {excel_file}", file=sys.stderr)
            result = extract_timesheet_data_from_excel(excel_file)
            if result:
                print("✅ Extraction successful!", file=sys.stderr)
            else:
                print("❌ Extraction failed!", file=sys.stderr)
        else:
            print(f"❌ File not found: {excel_file}", file=sys.stderr)
    else:
        print("Usage: python excelextract.py <excel_file_path>", file=sys.stderr)
        test_excel_extraction()
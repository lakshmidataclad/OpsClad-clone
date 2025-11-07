"""Gmail Timesheet Email Downloader

Detects timesheet emails and downloads their attachments."""

import os
import imaplib
import email
import sys
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Union
from dataclasses import dataclass

@dataclass
class TimesheetEmail:
    """Data class to store timesheet email information"""
    email_id: str
    sender: str
    subject: str
    date: datetime
    attachment_names: List[str]
    matched_keywords: List[str]

class GmailTimesheetDetector:
    """Detects timesheet emails from Gmail inbox and downloads attachments"""
    
    def __init__(self, email_address: str, password: str):
        self.email_address = email_address
        self.password = password
        self.imap_server = None
        
        # Keywords for timesheet detection
        self.timesheet_keywords = [
            'timesheet', 'time-sheet', 'time sheet', 'timecard', 'time card',
            'hours', 'weekly hours', 'work hours', 'time log', 'time entry', 
            'hours worked', 'weekly report', 'time report', 'payroll',
            'schedule', 'work schedule', 'attendance'
        ]

    def connect(self) -> bool:
        """Connect to Gmail using IMAP"""
        try:
            print("🔗 Connecting to Gmail...", file=sys.stderr)
            self.imap_server = imaplib.IMAP4_SSL('imap.gmail.com')
            self.imap_server.login(self.email_address, self.password)
            print("✅ Connected to Gmail successfully!", file=sys.stderr)
            return True
        except Exception as e:
            print(f"❌ Connection failed: {e}", file=sys.stderr)
            print("\n🔧 Troubleshooting:", file=sys.stderr)
            print("1. Make sure you're using an App Password, not your regular password", file=sys.stderr)
            print("2. Enable 2FA: https://myaccount.google.com/security", file=sys.stderr)
            print("3. Create App Password: https://myaccount.google.com/apppasswords", file=sys.stderr)
            return False

    def disconnect(self):
        """Disconnect from Gmail"""
        if self.imap_server:
            try:
                self.imap_server.close()
                self.imap_server.logout()
            except:
                pass
            print("📡 Disconnected from Gmail", file=sys.stderr)

    def is_timesheet_email(self, subject: str) -> tuple:
        """Check if email subject indicates a timesheet"""
        subject_lower = subject.lower()
        matches = []
        
        for keyword in self.timesheet_keywords:
            if keyword in subject_lower:
                matches.append(keyword)
        
        return len(matches) > 0, matches

    def get_attachments(self, email_message) -> List[str]:
        """Extract attachment filenames from email"""
        attachments = []
        
        for part in email_message.walk():
            if part.get_content_disposition() == 'attachment':
                filename = part.get_filename()
                if filename:
                    attachments.append(filename)
        
        return attachments

    def _parse_date_input(self, date_input: Union[str, datetime, int, float, dict, list]) -> datetime:
        """Parse various date input formats into datetime object, including date picker formats"""
        # Handle None or empty values
        if date_input is None:
            raise ValueError("Date input cannot be None")
        
        # Handle datetime objects
        if isinstance(date_input, datetime):
            return date_input
        
        # Handle date objects (from datetime.date)
        if hasattr(date_input, 'year') and hasattr(date_input, 'month') and hasattr(date_input, 'day'):
            if hasattr(date_input, 'hour'):  # datetime object
                return date_input
            else:  # date object
                return datetime.combine(date_input, datetime.min.time())
        
        # Handle Unix timestamps (common from JavaScript Date.getTime() / 1000)
        if isinstance(date_input, (int, float)):
            try:
                # Handle both seconds and milliseconds timestamps
                if date_input > 1e10:  # Likely milliseconds
                    timestamp = date_input / 1000
                else:  # Likely seconds
                    timestamp = date_input
                return datetime.fromtimestamp(timestamp)
            except (ValueError, OSError) as e:
                raise ValueError(f"Invalid timestamp: {date_input}")
        
        # Handle string inputs
        if isinstance(date_input, str):
            # Handle empty strings
            if not date_input.strip():
                raise ValueError("Date input cannot be empty")
            
            # Try ISO format first (common from date pickers)
            date_str = date_input.strip()
            
            # Handle ISO formats with timezone info
            if 'T' in date_str:
                # Remove timezone info if present
                if '+' in date_str:
                    date_str = date_str.split('+')[0]
                elif date_str.endswith('Z'):
                    date_str = date_str[:-1]
                elif date_str.count('-') > 2:  # Has timezone offset
                    # Find the last occurrence of + or - that's not part of the date
                    for i in range(len(date_str) - 1, -1, -1):
                        if date_str[i] in '+-' and i > 10:  # After date part
                            date_str = date_str[:i]
                            break
            
            # Try different date formats
            date_formats = [
                '%Y-%m-%dT%H:%M:%S.%f',  # 2024-01-15T10:30:00.000 (ISO with microseconds)
                '%Y-%m-%dT%H:%M:%S',     # 2024-01-15T10:30:00 (ISO format)
                '%Y-%m-%dT%H:%M',        # 2024-01-15T10:30 (ISO format short)
                '%Y-%m-%d %H:%M:%S.%f',  # 2024-01-15 10:30:00.000
                '%Y-%m-%d %H:%M:%S',     # 2024-01-15 10:30:00
                '%Y-%m-%d %H:%M',        # 2024-01-15 10:30
                '%Y-%m-%d',              # 2024-01-15
                '%m/%d/%Y %H:%M:%S',     # 01/15/2024 10:30:00
                '%m/%d/%Y %H:%M',        # 01/15/2024 10:30
                '%m/%d/%Y',              # 01/15/2024
                '%d/%m/%Y',              # 15/01/2024
                '%B %d, %Y',             # January 15, 2024
                '%b %d, %Y',             # Jan 15, 2024
                '%d %B %Y',              # 15 January 2024
                '%d %b %Y',              # 15 Jan 2024
            ]
            
            for fmt in date_formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            
            # If no format matches, raise an error
            raise ValueError(f"Unable to parse date: '{date_input}'. Please use formats like YYYY-MM-DD, MM/DD/YYYY, or ISO format")
        
        # Handle dictionary inputs (common from some date pickers)
        if isinstance(date_input, dict):
            try:
                # Try to extract year, month, day from dictionary
                if all(key in date_input for key in ['year', 'month', 'day']):
                    year = int(date_input['year'])
                    month = int(date_input['month'])
                    day = int(date_input['day'])
                    hour = int(date_input.get('hour', 0))
                    minute = int(date_input.get('minute', 0))
                    second = int(date_input.get('second', 0))
                    return datetime(year, month, day, hour, minute, second)
                else:
                    raise ValueError("Dictionary must contain 'year', 'month', and 'day' keys")
            except (ValueError, KeyError) as e:
                raise ValueError(f"Invalid date dictionary: {date_input}")
        
        # Handle list/array inputs (like [2024, 1, 15])
        if isinstance(date_input, (list, tuple)):
            try:
                if len(date_input) >= 3:
                    year, month, day = int(date_input[0]), int(date_input[1]), int(date_input[2])
                    hour = int(date_input[3]) if len(date_input) > 3 else 0
                    minute = int(date_input[4]) if len(date_input) > 4 else 0
                    second = int(date_input[5]) if len(date_input) > 5 else 0
                    return datetime(year, month, day, hour, minute, second)
                else:
                    raise ValueError("List/tuple must have at least 3 elements [year, month, day]")
            except (ValueError, IndexError) as e:
                raise ValueError(f"Invalid date list/tuple: {date_input}")
        
        # Handle other types more explicitly
        if hasattr(date_input, '__class__'):
            type_name = date_input.__class__.__name__
        else:
            type_name = str(type(date_input))
        
        raise TypeError(f"Date input must be string, datetime, timestamp, dict, or list, got {type_name}: {repr(date_input)}")

    def find_timesheet_emails(self, 
                            start_date: Union[str, datetime], 
                            end_date: Union[str, datetime], 
                            sender_filter: Optional[str] = None) -> List[TimesheetEmail]:
        """Find timesheet emails in the specified date range
        
        Args:
            start_date: Start date (string or datetime object)
            end_date: End date (string or datetime object)
            sender_filter: Optional email sender to filter by
            
        Returns:
            List of TimesheetEmail objects
        """
        if not self.imap_server:
            if not self.connect():
                return []
        
        try:
            # Validate inputs before parsing
            print(f"🔍 Debug: start_date = {repr(start_date)} (type: {type(start_date)})", file=sys.stderr)
            print(f"🔍 Debug: end_date = {repr(end_date)} (type: {type(end_date)})", file=sys.stderr)
            
            # Parse date inputs
            try:
                parsed_start_date = self._parse_date_input(start_date)
                parsed_end_date = self._parse_date_input(end_date)
            except (ValueError, TypeError) as e:
                print(f"❌ Date parsing error: {e}", file=sys.stderr)
                print("💡 Supported date formats:", file=sys.stderr)
                print("  - YYYY-MM-DD (e.g., 2024-01-15)", file=sys.stderr)
                print("  - MM/DD/YYYY (e.g., 01/15/2024)", file=sys.stderr)
                print("  - Month DD, YYYY (e.g., January 15, 2024)", file=sys.stderr)
                return []
            
            # Ensure start_date is before end_date
            if parsed_start_date > parsed_end_date:
                print("❌ Start date must be before end date", file=sys.stderr)
                return []
            
            # Set time to beginning/end of day if no time specified
            if parsed_start_date.time() == datetime.min.time():
                parsed_start_date = parsed_start_date.replace(hour=0, minute=0, second=0)
            if parsed_end_date.time() == datetime.min.time():
                parsed_end_date = parsed_end_date.replace(hour=23, minute=59, second=59)
            
            self.imap_server.select('inbox')
            
            # Build search criteria using IMAP date format
            start_str = parsed_start_date.strftime('%d-%b-%Y')
            end_str = parsed_end_date.strftime('%d-%b-%Y')
            
            # Build search criteria
            search_criteria = f'(SINCE {start_str} BEFORE {end_str})'
            
            if sender_filter:
                search_criteria = f'(SINCE {start_str} BEFORE {end_str} FROM "{sender_filter}")'
            
            print(f"🔍 Searching for timesheet emails from {parsed_start_date.date()} to {parsed_end_date.date()}", file=sys.stderr)
            if sender_filter:
                print(f"📧 Filtering by sender: {sender_filter}", file=sys.stderr)
            
            # Search emails
            status, message_ids = self.imap_server.search(None, search_criteria)
            
            if status != 'OK' or not message_ids[0]:
                print("❌ No emails found in date range", file=sys.stderr)
                return []
            
            timesheet_emails = []
            message_list = message_ids[0].split()
            
            print(f"📧 Scanning {len(message_list)} emails...", file=sys.stderr)
            
            # Process each email
            for msg_id in message_list:
                try:
                    status, msg_data = self.imap_server.fetch(msg_id, '(RFC822)')
                    if status != 'OK':
                        continue
                    
                    email_message = email.message_from_bytes(msg_data[0][1])
                    
                    # Extract email info
                    subject = email_message.get('Subject', '')
                    sender = email_message.get('From', '')
                    date_str = email_message.get('Date', '')
                    
                    # Parse date
                    try:
                        email_date = email.utils.parsedate_to_datetime(date_str)
                        email_date = email_date.replace(tzinfo=None)
                    except:
                        email_date = datetime.now()
                    
                    # Double-check date range (IMAP search can be imprecise)
                    if email_date < parsed_start_date or email_date > parsed_end_date:
                        continue
                    
                    # Check if this is a timesheet email
                    is_timesheet, matches = self.is_timesheet_email(subject)
                    
                    if is_timesheet:
                        attachments = self.get_attachments(email_message)
                        
                        timesheet_email = TimesheetEmail(
                            email_id=msg_id.decode(),
                            sender=sender,
                            subject=subject,
                            date=email_date,
                            attachment_names=attachments,
                            matched_keywords=matches
                        )
                        timesheet_emails.append(timesheet_email)
                
                except Exception as e:
                    print(f"⚠️ Error processing email: {e}", file=sys.stderr)
                    continue
            
            # Sort by date (newest first)
            timesheet_emails.sort(key=lambda x: x.date, reverse=True)
            
            return timesheet_emails
            
        except Exception as e:
            print(f"❌ Error searching emails: {e}", file=sys.stderr)
            return []

    def find_timesheet_emails_last_days(self, days_back: int = 7, sender_filter: Optional[str] = None) -> List[TimesheetEmail]:
        """Convenience method to find emails from the last N days
        
        Args:
            days_back: Number of days to look back
            sender_filter: Optional email sender to filter by
            
        Returns:
            List of TimesheetEmail objects
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        return self.find_timesheet_emails(start_date, end_date, sender_filter)

    def download_attachments(self, timesheet_email: TimesheetEmail, download_dir: str = "timesheet_attachments"):
        """Download attachments from a timesheet email"""
        if not timesheet_email.attachment_names:
            print(f"📎 No attachments found in email: {timesheet_email.subject}", file=sys.stderr)
            return []
        
        # Create download directory
        os.makedirs(download_dir, exist_ok=True)
        
        try:
            # Fetch the email again to get attachments
            status, msg_data = self.imap_server.fetch(timesheet_email.email_id, '(RFC822)')
            if status != 'OK':
                print(f"❌ Failed to fetch email for attachments", file=sys.stderr)
                return []
            
            email_message = email.message_from_bytes(msg_data[0][1])
            downloaded_files = []
            
            # Process attachments
            for part in email_message.walk():
                if part.get_content_disposition() == 'attachment':
                    filename = part.get_filename()
                    if filename:
                        # Create safe filename
                        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
                        file_path = os.path.join(download_dir, safe_filename)
                        
                        # Save attachment
                        with open(file_path, 'wb') as f:
                            f.write(part.get_payload(decode=True))
                        
                        downloaded_files.append(file_path)
                        print(f"📎 Downloaded: {safe_filename}", file=sys.stderr)
            
            return downloaded_files
            
        except Exception as e:
            print(f"❌ Error downloading attachments: {e}", file=sys.stderr)
            return []

    def display_results(self, timesheet_emails: List[TimesheetEmail]):
        """Display found timesheet emails"""
        if not timesheet_emails:
            print("❌ No timesheet emails found", file=sys.stderr)
            return
        
        print(f"\n✅ Found {len(timesheet_emails)} timesheet email(s):", file=sys.stderr)
        print("=" * 70, file=sys.stderr)
        
        for i, email_info in enumerate(timesheet_emails, 1):
            print(f"\n{i}. {email_info.subject}", file=sys.stderr)
            print(f"   From: {email_info.sender}", file=sys.stderr)
            print(f"   Date: {email_info.date.strftime('%Y-%m-%d %H:%M')}", file=sys.stderr)
            print(f"   Keywords: {', '.join(email_info.matched_keywords)}", file=sys.stderr)
            
            if email_info.attachment_names:
                print(f"   Attachments: {', '.join(email_info.attachment_names)}", file=sys.stderr)
            else:
                print(f"   Attachments: None", file=sys.stderr)


# Example usage
if __name__ == "__main__":
    # Example of how to use the updated class
    email_addr = "your_email@gmail.com"
    app_password = "your_app_password"
    
    detector = GmailTimesheetDetector(email_addr, app_password)
    
    try:
        # Option 1: Search by specific date range
        timesheet_emails = detector.find_timesheet_emails(
            start_date="2024-01-01",
            end_date="2024-01-31",
            sender_filter="hr@company.com"  # Optional
        )
        
        # Option 2: Search last 7 days (backward compatibility)
        # timesheet_emails = detector.find_timesheet_emails_last_days(days_back=7)
        
        # Display results
        detector.display_results(timesheet_emails)
        
        # Download attachments from first email if found
        if timesheet_emails:
            downloaded = detector.download_attachments(timesheet_emails[0])
            print(f"Downloaded {len(downloaded)} files")
    
    finally:
        detector.disconnect()
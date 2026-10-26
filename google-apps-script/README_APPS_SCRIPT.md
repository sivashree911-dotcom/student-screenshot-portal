# Google Sheet & Google Apps Script Setup Guide

Follow these steps to link your college's approved student list Google Sheet with the **Student Screenshot Portal**.

---

## 1. Google Sheet & Worksheet Structure

1. Open your approved students Google Sheet (e.g. named **"Approved Students - Screenshot Portal"** or **"Elite Students"**).
2. The script looks for a tab named **"Elite Students"** (preferred) or **"Students"**.
3. In Row 1, ensure the following column headers exist (header detection is case-insensitive and flexible):

| Register Number | Student Name | Email | Department | Year | Section | Status |
|---|---|---|---|---|---|---|
| `95072512207` | `THANGAM K K` | `thangam@college.edu` | `CSE` | `II` | `A` | `Active` |

4. Populate student rows with approved students. If a student is marked with status `Inactive` or `Blocked`, they will not be allowed to register.

---

## 2. Install / Update the Google Apps Script API

1. In your Google Sheet, click on **Extensions** > **Apps Script** from the top menu.
2. Replace any existing code in `Code.gs` with the updated contents of [`Code.gs`](./Code.gs).
3. Click the **Save** icon (diskette) or press `Ctrl + S`.

---

## 3. Deploy as a Web App

1. In the top right of the Apps Script window, click **Deploy** > **New deployment** (or **Manage deployments** > **Edit** > **New version**).
2. Select type: **Web app**.
3. Fill in the deployment configuration:
   - **Description**: `Student Screenshot Portal Verification API - Elite Students Update`
   - **Execute as**: `Me (your_email@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial: allows the backend server to communicate with the API)*
4. Click **Deploy**.
5. When prompted, click **Authorize access** and choose your Google account. (If a warning appears, click *Advanced* > *Go to Student Verification (unsafe)* and allow).
6. Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 4. Configure Backend Environment

Ensure the URL is set in your `backend/.env` file:

```env
APPS_SCRIPT_API_URL=https://script.google.com/macros/s/AKfycb.../exec
```

Restart your backend server:
```bash
npm run dev
```

---

## 5. Verification Endpoint Testing

Test with curl or in your browser:

```bash
# 1. Verify single student:
curl "https://script.google.com/macros/s/AKfycb.../exec?operation=verifyStudent&registerNumber=95072512207"

# 2. Fetch all approved students:
curl "https://script.google.com/macros/s/AKfycb.../exec?operation=getAllStudents"

# 3. Health check:
curl "https://script.google.com/macros/s/AKfycb.../exec?operation=healthCheck"
```

Expected single verification response:
```json
{
  "success": true,
  "found": true,
  "message": "Student verified successfully.",
  "student": {
    "registerNumber": "95072512207",
    "name": "THANGAM K K",
    "email": "thangam@college.edu",
    "department": "CSE",
    "year": "II",
    "section": "A",
    "status": "Active"
  }
}
```

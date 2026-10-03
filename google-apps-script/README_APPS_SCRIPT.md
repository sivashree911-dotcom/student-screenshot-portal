# Google Sheet & Google Apps Script Setup Guide

Follow these steps to link your college's approved student list Google Sheet with the **Student Screenshot Portal**.

---

## 1. Create the Google Sheet

1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet named **"Approved Students - Screenshot Portal"**.
2. Rename the first tab/sheet to **"Students"**.
3. In Row 1, add these exact column headers:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| **Register Number** | **Student Name** | **Email** | **Department** | **Year** | **Section** | **Status** |

4. Populate student rows with the approved students (e.g., Register Number: `1300`, Student Name: `Aarav Sharma`, Department: `CSE`, Year: `2`, Section: `A`, Status: `Active`).

---

## 2. Install the Google Apps Script API

1. In your Google Sheet, click on **Extensions** > **Apps Script** from the top menu.
2. Delete any existing code in the editor.
3. Open [`Code.gs`](./Code.gs) in this directory, copy its entire contents, and paste into the Apps Script editor.
4. Click the **Save** icon (diskette) or press `Ctrl + S`.

---

## 3. Deploy as a Web App

1. In the top right of the Apps Script window, click **Deploy** > **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in the deployment configuration:
   - **Description**: `Student Screenshot Portal Verification API`
   - **Execute as**: `Me (your_email@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial: allows the backend server to communicate with the API)*
4. Click **Deploy**.
5. When prompted, click **Authorize access** and choose your Google account. (If a warning appears, click *Advanced* > *Go to Student Verification (unsafe)* and allow).
6. Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).

---

## 4. Configure Backend Environment

Paste the copied URL into your `backend/.env` file:

```env
APPS_SCRIPT_API_URL=https://script.google.com/macros/s/AKfycb.../exec
```

Restart your backend server:
```bash
npm run dev
```

---

## 5. Verification Endpoint Testing

Test in your browser or with curl:

```bash
curl "https://script.google.com/macros/s/AKfycb.../exec?operation=verifyStudent&registerNumber=1300"
```

Response format:
```json
{
  "success": true,
  "found": true,
  "student": {
    "registerNumber": "1300",
    "name": "Aarav Sharma",
    "email": "aarav.sharma@college.edu",
    "department": "CSE",
    "year": "2",
    "section": "A",
    "status": "Active"
  }
}
```

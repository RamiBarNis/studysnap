# הפעלת Google Sign-In ב־StudyBrain

הקוד משתמש ב־Google Identity Services ומאמת את הזהות בשרת. כרגע חסר רק Client ID לפרויקט שלך. לא צריך למסור Client Secret או סיסמה.

1. פתח https://console.cloud.google.com/ ובחר או צור פרויקט בשם StudyBrain.
2. ב־Google Auth Platform הגדר Branding / Audience: שם האפליקציה StudyBrain, דוא״ל תמיכה ודוא״ל איש קשר. אם האפליקציה במצב Testing, הוסף את חשבון הגוגל שלך ל־Test users.
3. עבור אל Clients ובחר Create client → Web application.
4. הוסף ל־Authorized JavaScript origins את הכתובות:
   - `http://localhost`
   - `http://localhost:8000`
   - `http://127.0.0.1:8000`
5. העתק את Client ID שמסתיים ב־`.apps.googleusercontent.com`.
6. העתק את `.env.example` לקובץ `.env` בתיקיית הפרויקט, ומלא:

   ```text
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   STUDYBRAIN_PORT=8000
   ```

7. עצור את שרת StudyBrain והפעל מחדש דרך `start.command`. פתח `http://127.0.0.1:8000`, לחץ על ״התחברות עם Google״ ובחר חשבון. ייתכן שלהגדרת גוגל ייקח זמן להתעדכן.

אפשר גם לשלוח בצ׳אט את ה־Client ID הציבורי, ואגדיר את הקובץ המקומי עבורך.

## מה ההתחברות עושה

השרת בודק את חתימת Google, קהל היעד, המנפיק, התוקף וה־nonce. לאחר אימות הוא יוצר עוגיית session מסוג HttpOnly, התקפה לשבעה ימים. התנתקות מבטלת את ה־session בשרת.

זהו שרת מקומי הקשור ל־127.0.0.1 בלבד. העוגייה אינה Secure כי הפיתוח המקומי הוא HTTP; לפני פריסה ציבורית נדרשים HTTPS, עוגיית Secure, הגדרת origin של הדומיין ושרת production מתאים.

המטלות והקבצים עדיין שייכים לאחסון של הדפדפן הזה: אין סנכרון לענן או הפרדה בין חשבונות במחשב המשותף. גוגל משמשת לזיהוי בלבד. ההתחברות אינה מתחברת לחשבון למדה.

## מקורות רשמיים

- הגדרת Client ID: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- אימות בשרת: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

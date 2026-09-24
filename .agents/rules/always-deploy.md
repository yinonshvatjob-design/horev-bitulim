---
description: Always automatically deploy code changes to Vercel via GitHub
---

# Auto-Deploy Rule
The user explicitly requested: "אני רוצה שכל פעם שיש עדכון הוא יעלה אוטומטית בלי שום עיכובים. אלא הכל יתעדכן כל פעם מהתחלה עד הסוף."

Whenever you finish making code updates to this project:
1. Automatically add all modified files (`git add .`).
2. Commit them with a descriptive message (`git commit -m "..."`).
3. Push them to the origin main branch (`git push`).
This will trigger the automatic Vercel deployment. Do not ask for permission to do this, just do it as the final step of your work so the user always has the live site updated.

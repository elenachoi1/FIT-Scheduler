# FIT Scheduler

A When2meet-style group scheduling app for FIT students, styled after the PRISM LCA app.
It runs on GitHub Pages (free hosting) and Supabase (free database and sign-in).

**Live site:** https://elenachoi1.github.io/FIT-Scheduler/

## Features
- **Sign in:** Google, or email and password
- **Groups:** create a group, join with an invite link, rename it (owner), leave or delete it
- **Events:** pick dates on a calendar (click or drag), set a time range and slot size (15, 30 or 60 minutes)
- **Your availability:** click and drag to mark your free times; changes **save automatically**
- **Group heatmap:** updates live as others respond; hover over a slot to see who is free
- **✨ Best times:** choose a meeting length (30 min to 3 hours) to see the top 5 times when the most people are free; click one to highlight it on the heatmap
- **Time zone:** every time is shown in **New York time (ET)**
- Dark and light themes, matching PRISM

## Project structure
```
index.html          App entry point
app.js              Screens and app logic
recommend.js        Best-time recommendation
styles.css          Styling (change the variables at the top to change colors)
config.js           Supabase project URL and public key
supabase/schema.sql Database tables and security rules (run once in Supabase)
```

---

## Setup

### 1. Create the Supabase project
1. Sign up at https://supabase.com and create a **New project**.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**.
3. In **Project Settings → API Keys**, copy the **Project URL** and the **publishable (anon) key**.
4. Paste both into `config.js`.
   > The publishable key is meant to be public. The Row Level Security rules in `schema.sql` protect the data.
   > Never put the `service_role` or secret key in this project.

### 2. Publish on GitHub Pages
1. Upload all files to a GitHub repository.
2. Go to **Settings → Pages**, set Source to **Deploy from a branch**, Branch to **main** and **/ (root)**, then click **Save**.
3. After a minute or two the site is live at `https://<username>.github.io/<repository>/`.

### 3. Configure sign-in in Supabase
Under **Authentication → URL Configuration**:
- **Site URL:** your GitHub Pages address
- **Redirect URLs:** add the same address

**Email sign-in** is on by default, and new users get a confirmation email. To skip that while testing, turn off **Confirm email** under *Authentication → Sign In / Providers → Email*.

**Google sign-in** is optional:
1. In https://console.cloud.google.com, go to **APIs & Services → Credentials → Create Credentials → OAuth client ID** and choose **Web application**.
2. Under **Authorized redirect URIs**, add the Callback URL shown in Supabase under *Authentication → Sign In / Providers → Google*.
3. Paste the Client ID and Client Secret into the Supabase Google provider and click **Enable**.

### 4. Use it
1. Sign in and click **Create group**.
2. On the group page, click **Copy invite link** and send it to your teammates.
3. Click **New event** and choose the dates and times.
4. Everyone drags over their free times. Their changes save automatically, and the best times appear on the right.

## Run locally
```bash
python3 -m http.server 8000
# Open http://localhost:8000 (also add it to Redirect URLs in Supabase)
```

## Changing the design
Edit the color variables in the `:root` block at the top of `styles.css`.
`--heat-rgb` sets the heatmap color and `--mine` sets the color of your own selected slots.

## Permissions
| Action | Who can do it |
|---|---|
| View groups and events | Group members only |
| Rename or delete a group | Group owner |
| Create an event | Any group member |
| Delete an event | The person who created it |
| Edit availability | Each person, for their own only |

## Built with
Plain HTML, CSS and JavaScript (no build step), [Supabase](https://supabase.com) for the database, sign-in and live updates, and GitHub Pages for hosting.

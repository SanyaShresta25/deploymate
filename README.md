# DeployMate Dashboard

![Project](https://img.shields.io/badge/Project-DeployMate-black)
![Frontend](https://img.shields.io/badge/Frontend-React-61dafb)
![Backend](https://img.shields.io/badge/Backend-Flask-000000)
![Language](https://img.shields.io/badge/Language-JavaScript%20%2B%20Python-blue)
![Container](https://img.shields.io/badge/Container-Docker-2496ed)
![API](https://img.shields.io/badge/API-REST-22c55e)
![Status](https://img.shields.io/badge/Status-Active-success)
![Auth](https://img.shields.io/badge/Auth-Token%20Login-orange)
![UI](https://img.shields.io/badge/UI-Dashboard-8b5cf6)
![Open Source](https://img.shields.io/badge/Open%20Source-Yes-brightgreen)
![Made with Love](https://img.shields.io/badge/Made%20with-Love-ff4d6d)
![Beginner Friendly](https://img.shields.io/badge/Beginner-Friendly-14b8a6)

## Q: What is this?
A: This is a small dashboard that helps you see your services and deploy them with one click.

## Q: What are "services"?
A: Services are parts of your app, like `frontend`, `backend`, and `database`.

## Q: What can I do here?
A: You can:
- See if a service is running.
- Deploy a service.
- Read logs (messages about what happened).

## Q: Why do I need to log in?
A: Login keeps deploy buttons safe, so random people cannot deploy your app.

## Q: What is the default login?
A:
- Username: `admin`
- Password: `admin123`

## Q: Can I change username and password?
A: Yes. In backend environment variables, set:
- `DEPLOYMATE_USERNAME`
- `DEPLOYMATE_PASSWORD`
- `DEPLOYMATE_API_TOKEN`

## Q: How do I run this on my computer?
A:
1. Start backend:
```bash
cd backend
pip install -r requirements.txt
python app.py
```
2. Start frontend:
```bash
cd frontend
npm install
npm start
```
3. Open browser:
- `https://deploymate-ashen.vercel.app/`

## Q: How does the dashboard talk to backend?
A: Frontend uses:
- `REACT_APP_API_BASE_URL`

Example in `frontend/.env`:
```env
REACT_APP_API_BASE_URL=https://deploymate-ashen.vercel.app/
```

## Q: I get "Login failed". What should I do?
A:
1. Check you are using the correct username and password.
2. Make sure backend is running.
3. Make sure frontend points to the correct backend URL.
4. If using deployed backend, set the same env vars there too.

## Q: Is this production-ready?
A: It is a great learning project and a solid starter. For production, add stronger auth, HTTPS, audit logs, and CI/CD checks.

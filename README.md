# Lost and Found Application

A simple web application to help users post and find lost items.

## Features

- Post lost or found items with details and images
- Browse through all items in a card view
- Search and filter items by various parameters
- View detailed information about each item
- Basic matching system for lost and found items

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Database: SQLite
- Image Storage: Local file storage

## Project Structure

```
LostandFound/
├── public/            # Static files (CSS, JS, images)
│   ├── css/           # CSS stylesheets
│   ├── js/            # JavaScript files
│   └── uploads/       # Uploaded images
├── views/             # HTML templates
├── database/          # Database files
├── routes/            # API endpoints
├── app.js             # Main application file
├── package.json       # Dependencies
└── README.md          # Documentation
```

## Setup Instructions

1. Install Node.js and npm if not already installed
2. Clone this repository
3. Install dependencies:
   ```
   npm install
   ```
4. Start the application:
   ```
   npm start
   ```
5. Access the application at: http://localhost:3000

## Future Enhancements (Phase 2)

- User authentication system
- Karma points system
- Notifications
- Reward system
- Advanced AI matching system 
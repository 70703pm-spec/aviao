# Backend API Documentation

## Overview
This is the backend for the full-stack application, built using Node.js and Express. It provides a RESTful API for managing items in the database.

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd my-fullstack-app/backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Database**
   Update the database connection settings in `src/config/database.js` to match your database configuration.

4. **Run the Application**
   ```bash
   npm start
   ```

## API Endpoints

### Get Items
- **Endpoint:** `GET /api/items`
- **Description:** Retrieves a list of items from the database.
- **Response:** JSON array of items.

### Add Item
- **Endpoint:** `POST /api/items`
- **Description:** Adds a new item to the database.
- **Request Body:**
  ```json
  {
    "name": "Item Name",
    "description": "Item Description"
  }
  ```
- **Response:** JSON object of the created item.

## Testing
You can test the API using tools like Postman or cURL.

## License
This project is licensed under the MIT License.
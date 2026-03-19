# Frontend Full-Stack Application

This is the frontend part of the full-stack application, built using React. Below are the instructions for setting up and running the frontend.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd my-fullstack-app/frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

   This will start the development server and open the application in your default web browser.

## Folder Structure

- `src/`: Contains the source code for the application.
  - `App.js`: Main component that sets up routing.
  - `components/`: Contains reusable components like `ItemList` and `ItemForm`.
  - `pages/`: Contains main pages such as `HomePage` and `ItemPage`.
  - `services/`: Contains API service functions for fetching and adding items.

- `public/`: Contains the static files, including `index.html`.

## Features

- Fetch and display a list of items from the backend.
- Add new items to the database through a form.

## Built With

- [React](https://reactjs.org/) - JavaScript library for building user interfaces
- [Axios](https://axios-http.com/) - Promise-based HTTP client for the browser and Node.js

## Contributing

If you want to contribute to this project, please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
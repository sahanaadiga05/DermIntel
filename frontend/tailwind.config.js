/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
    "./store/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#10231a",
        mist: "#f5efe5",
        sage: "#8eb69b",
        pine: "#183c2d",
        coral: "#ff8b61",
        gold: "#f0c05b"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(16, 35, 26, 0.12)"
      }
    }
  },
  plugins: []
};


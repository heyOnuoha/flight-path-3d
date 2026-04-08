# FlightPath 3D

FlightPath3D is a highly interactive, 3D flight tracking application built using Next.js and Three.js. It visualizes real-time global aviation traffic with an interactive 3D Earth globe, enabling users to explore flight data, monitor trajectories, and view detailed telemetry intuitively.

## 🚀 Features
- **Interactive 3D Globe**: Built using `@react-three/fiber` and `@react-three/drei` for highly optimized, realistic Earth visualization.
- **Real-Time Flight Data**: Integrating real-world flight location, speed, and heading data powered by the [Aviationstack API by APILAYER](https://apilayer.com).
- **Realistic Aircraft Movement**: Uses client-side dead-reckoning to smoothly animate planes across the 3D map between API updates, naturally orienting them towards their heading.
- **Modern UI**: Uses Next.js App Router, Tailwind CSS, Framer Motion for micro-animations, and Lucide React icons for a beautiful, responsive user interface.

## 📋 Prerequisites

Before running the project locally, you will need the following installed:
- Node.js (v18 or higher recommended)
- npm, yarn, bun, or pnpm

You will also need an API key from Aviationstack.

## 🛠️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/heyOnuoha/flight-path-3d.git
cd FlightPath3D
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set up Environment Variables

Create a `.env.local` or `.env` file in the root of your project based on the `.env.example` file provided:
```bash
cp .env.example .env.local
```

Add your Aviationstack API Key in the `.env.local` file:
```env
AVIATION_STACK_API_KEY=your_api_key_here
```
*Note: You can get one by signing up at [Aviationstack's website](https://aviationstack.com).*

### 4. Run the Development Server

Start up the local development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure 

The main directories of the project setup are:
- `app/`: Next.js App Router root, containing page styles and API routes used for fetching flight telemetry.
- `components/`: Contains foundational React components.
  - `Scene.tsx`: The primary 3D canvas rendering engine.
  - `EarthGlobe.tsx`: Represents the interactive 3D Earth.
  - `AirplaneMesh.tsx`: Render and path extrapolation (dead reckoning) logic for interactive airplanes.
  - `UIOverlay.tsx`: Contains the 2D overlay design including telemetry and flight lists.

## 🧰 Technology Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **3D Rendering**: [Three.js](https://threejs.org/) / [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) / [React Three Drei](https://github.com/pmndrs/drei)
- **API**: [Aviationstack API](https://aviationstack.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 🤝 Contributing

We welcome contributions to FlightPath3D! Here's how you can help:

1. **Fork the repository.**
2. **Create a new branch** (`git checkout -b feature/amazing-feature`).
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`).
4. **Push to the branch** (`git push origin feature/amazing-feature`).
5. **Open a Pull Request.**

Please ensure your code follows the existing style and check for any linting errors before submitting your PR.

## 📄 License & Acknowledgments

Flight data is provided by the [Aviationstack API](https://aviationstack.com)  by [APILAYER](https://apilayer.com). This project is for educational and personal use. Please refer to their respective terms of service before using in a production environment.

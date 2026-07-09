import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Predictions from "./pages/Predictions";
import Leaderboard from "./pages/Leaderboard";
import Champion from "./pages/Champion";
import Profile from "./pages/Profile";
import WinnerPage from "./pages/Winner";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminGames from "./pages/admin/AdminGames";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminWinner from "./pages/admin/AdminWinner";
import AdminChampion from "./pages/admin/AdminChampion";

export default function App() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/champion" element={<Champion />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/winners" element={<WinnerPage />} />
        <Route path="/profile" element={<Profile />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/games" element={<ProtectedRoute adminOnly><AdminGames /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/payments" element={<ProtectedRoute adminOnly><AdminPayments /></ProtectedRoute>} />
        <Route path="/admin/champion" element={<ProtectedRoute adminOnly><AdminChampion /></ProtectedRoute>} />
        <Route path="/admin/winners" element={<ProtectedRoute adminOnly><AdminWinner /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

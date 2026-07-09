import { useEffect, useState } from "react";
import { Chip } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LockIcon from "@mui/icons-material/Lock";

/** Live countdown to kickoff; shows "Locked" once the time passes. */
export default function Countdown({ target, locked }: { target: string; locked?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = new Date(target).getTime() - now;
  if (locked || diff <= 0) {
    return <Chip size="small" color="default" icon={<LockIcon sx={{ fontSize: 16 }} />} label="Locked" />;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const label = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
  return (
    <Chip size="small" color={d === 0 && h < 2 ? "warning" : "primary"}
          variant="outlined" icon={<AccessTimeIcon sx={{ fontSize: 16 }} />} label={label} />
  );
}

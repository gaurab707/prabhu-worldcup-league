#!/usr/bin/env bash
# Print the machine's LAN IPv4 so colleagues can reach the app.
echo "Share these addresses on your office network:"
if command -v ip >/dev/null 2>&1; then
  IP=$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
else
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
fi
echo "   Web app : http://${IP:-<your-ip>}:3000"
echo "   API     : http://${IP:-<your-ip>}:8000"
echo ""
echo "Set VITE_API_URL in frontend/.env to the API address above,"
echo "then restart the frontend so other machines can log in."

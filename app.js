// js/app.js

// Predefined accounts & PINs (Change these to your private PINs)
const USERS = {
  partner1: { name: "Vedant", pin: "1234" },
  partner2: { name: "Partner", pin: "5678" }
};

let currentUser = null;
let selectedUserId = null;
let selectedImageFile = null;

// --- 1. PIN Authentication ---
function selectUser(userId) {
  selectedUserId = userId;
  document.getElementById("pin-container").classList.remove("hidden");
  document.getElementById("pin-prompt").textContent = `Enter PIN for ${USERS[userId].name}`;
  document.getElementById("pin-input").value = "";
  document.getElementById("pin-input").focus();
}

function verifyPin() {
  const enteredPin = document.getElementById("pin-input").value;
  if (USERS[selectedUserId] && USERS[selectedUserId].pin === enteredPin) {
    currentUser = { id: selectedUserId, name: USERS[selectedUserId].name };
    localStorage.setItem("couple_app_user", JSON.stringify(currentUser));
    onLoginSuccess();
  } else {
    document.getElementById("login-error").textContent = "Incorrect PIN. Try again.";
  }
}

function onLoginSuccess() {
  document.getElementById("login-screen").classList.remove("active");
  document.getElementById("home-screen").classList.add("active");
  document.getElementById("user-display-name").textContent = currentUser.name;
  
  // Set partner display name on chat screen
  const partnerId = currentUser.id === "partner1" ? "partner2" : "partner1";
  document.getElementById("chat-partner-name").textContent = USERS[partnerId].name;

  // Track app activity for unfreeze logic
  recordUserActivity();

  // Listen to streaks and chat
  initStreakListener();
  initChatListener();
}

function logout() {
  localStorage.removeItem("couple_app_user");
  currentUser = null;
  location.reload();
}

// Auto-login if previously verified
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("couple_app_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    onLoginSuccess();
  }
});

// --- 2. Navigation Tabs ---
function switchTab(tab) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  if (tab === "home") {
    document.getElementById("home-screen").classList.add("active");
  } else if (tab === "chat") {
    document.getElementById("chat-screen").classList.add("active");
    scrollToBottom();
  }
}

// --- 3. Streak & Daily Moment System ---
function getTodayString() {
  return new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
}

async function recordUserActivity() {
  const today = getTodayString();
  const streakRef = db.collection("system").doc("streak_tracker");
  
  try {
    const doc = await streakRef.get();
    if (!doc.exists) {
      await streakRef.set({
        streakCount: 0,
        isFrozen: false,
        lastDate: today,
        posts: {},
        activeToday: { [currentUser.id]: today }
      });
      return;
    }

    const data = doc.data();
    const activeToday = data.activeToday || {};
    activeToday[currentUser.id] = today;

    // Check if both were active today to unfreeze if needed
    const partnerId = currentUser.id === "partner1" ? "partner2" : "partner1";
    let isFrozen = data.isFrozen;
    if (isFrozen && activeToday.partner1 === today && activeToday.partner2 === today) {
      isFrozen = false; // Both opened the app -> unfreeze
    }

    await streakRef.update({
      activeToday: activeToday,
      isFrozen: isFrozen
    });
  } catch (err) {
    console.error("Error updating user activity:", err);
  }
}

function initStreakListener() {
  const today = getTodayString();
  db.collection("system").doc("streak_tracker").onSnapshot(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    const streakCount = data.streakCount || 0;
    const postsToday = (data.posts && data.posts[today]) || {};
    const p1Posted = !!postsToday.partner1;
    const p2Posted = !!postsToday.partner2;

    document.getElementById("streak-count").textContent = `${streakCount} Days`;

    const iconEl = document.getElementById("streak-icon");
    const statusEl = document.getElementById("streak-status");
    const freezeEl = document.getElementById("freeze-banner");

    if (data.isFrozen) {
      freezeEl.classList.remove("hidden");
      iconEl.textContent = "🧊";
      iconEl.classList.remove("flame-glowing");
      statusEl.textContent = "Streak Frozen";
    } else {
      freezeEl.classList.add("hidden");
      if (p1Posted && p2Posted) {
        iconEl.textContent = "🔥";
        iconEl.classList.add("flame-glowing");
        statusEl.textContent = "Glowing! Both posted today.";
      } else {
        iconEl.textContent = "🔥";
        iconEl.classList.remove("flame-glowing");
        statusEl.textContent = `Pending: ${p1Posted ? "1/2" : (p2Posted ? "1/2" : "0/2")} posted`;
      }
    }
  });
}

function previewImage(input) {
  if (input.files && input.files[0]) {
    selectedImageFile = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById("image-preview").src = e.target.result;
      document.getElementById("image-preview-container").classList.remove("hidden");
    };
    reader.readAsDataURL(selectedImageFile);
  }
}

async function submitDailyMoment() {
  const note = document.getElementById("daily-note").value.trim();
  if (!note && !selectedImageFile) {
    alert("Please write a note or choose a photo.");
    return;
  }

  const today = getTodayString();
  let imageUrl = null;

  try {
    if (selectedImageFile) {
      const storageRef = storage.ref(`daily_moments/${today}_${currentUser.id}_${Date.now()}`);
      const uploadRes = await storageRef.put(selectedImageFile);
      imageUrl = await uploadRes.ref.getDownloadURL();
    }

    // Save moment to subcollection
    await db.collection("daily_moments").add({
      userId: currentUser.id,
      userName: currentUser.name,
      date: today,
      note: note,
      imageUrl: imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update streak tracker state
    const streakRef = db.collection("system").doc("streak_tracker");
    const snap = await streakRef.get();
    const data = snap.data() || { streakCount: 0, posts: {} };
    const posts = data.posts || {};
    const todayPosts = posts[today] || {};
    todayPosts[currentUser.id] = true;
    posts[today] = todayPosts;

    let newCount = data.streakCount;
    // If both have now posted today, increment streak
    if (todayPosts.partner1 && todayPosts.partner2) {
      newCount += 1;
    }

    await streakRef.update({
      posts: posts,
      streakCount: newCount,
      lastDate: today
    });

    alert("Moment shared successfully!");
    document.getElementById("daily-note").value = "";
    document.getElementById("image-preview-container").classList.add("hidden");
    selectedImageFile = null;
  } catch (err) {
    console.error("Error submitting moment:", err);
    alert("Could not share moment. Check connection.");
  }
}

// --- 4. WhatsApp-Style Realtime Chat ---
function initChatListener() {
  db.collection("chats")
    .orderBy("timestamp", "asc")
    .limitToLast(50)
    .onSnapshot(snapshot => {
      const container = document.getElementById("message-container");
      container.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();
        const isSent = msg.senderId === currentUser.id;
        
        const bubble = document.createElement("div");
        bubble.className = `message-bubble ${isSent ? "sent" : "received"}`;
        
        const text = document.createElement("p");
        text.textContent = msg.text;
        bubble.appendChild(text);

        const time = document.createElement("div");
        time.className = "message-time";
        if (msg.timestamp) {
          const d = msg.timestamp.toDate();
          time.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        bubble.appendChild(time);

        container.appendChild(bubble);
      });
      scrollToBottom();
    });
}

async function sendMessage() {
  const input = document.getElementById("chat-text-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  try {
    await db.collection("chats").add({
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

function handleChatEnter(e) {
  if (e.key === "Enter") sendMessage();
}

function scrollToBottom() {
  const container = document.getElementById("message-container");
  container.scrollTop = container.scrollHeight;
}

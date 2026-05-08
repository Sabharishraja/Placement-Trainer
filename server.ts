import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  serverTimestamp,
  FieldValue
} from "firebase/firestore";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Client SDK for Firestore operations (more robust in this sandbox)
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

const firebaseApp = initializeApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

async function findLeetCodeLink(title: string, manualLink?: string): Promise<string> {
  // If a valid URL is provided, use it. Otherwise, return a default search link.
  const link = manualLink?.trim();
  if (link && link.startsWith("http")) {
    return link;
  }
  
  // Default to a search link if no link provided
  const searchSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://leetcode.com/problemset/all/?search=${searchSlug}`;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  
  // 1. Auth - Register (Students only)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email, mobile } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Username and password required" });

      // Check if user exists
      const userRef = doc(db, "users", username);
      const userDoc = await getDocFromServer(userRef).catch(() => getDoc(userRef));
      if (userDoc.exists()) return res.status(400).json({ error: "Username already taken" });

      const hashedPassword = await bcrypt.hash(password, 10);
      await setDoc(userRef, {
        username,
        password: hashedPassword,
        email: email || "",
        mobile: mobile || "",
        role: "student",
        solvedQuestions: [],
        revisionNeeded: [],
        streak: 0,
        lastSolvedDate: null,
        lockInEnabled: false,
        lockInTime: "22:00",
        createdAt: serverTimestamp()
      });

      res.status(201).json({ message: "Student registered successfully" });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. Auth - Login (Combined Admin & Student)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Check Admin (from .env)
      const adminUser = process.env.ADMIN_USERNAME?.trim();
      const adminPass = process.env.ADMIN_PASSWORD?.trim();
      
      console.log(`Login attempt for: ${username}`);
      if (adminUser && adminPass && username === adminUser && password === adminPass) {
        console.log("Admin account identified and authenticated successfully.");
        const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
        return res.json({ token, role: "admin", username });
      }
      
      // If credentials don't match admin, we fall back to student check. 
      // This is expected behavior for student logins.
      if (username === adminUser) {
        console.log("Admin username matched, but password check failed.");
      } else {
        console.log("Not an admin account, checking student database...");
      }

      // Check Student (from Firestore)
      const userRef = doc(db, "users", username);
      const userDoc = await getDocFromServer(userRef).catch(err => {
        console.warn("Fallback to cache/offline getDoc for login", err.message);
        return getDoc(userRef);
      });
      
      if (!userDoc.exists()) return res.status(401).json({ error: "Invalid credentials" });
      
      const userData = userDoc.data();
      const isMatch = await bcrypt.compare(password, userData?.password);
      if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign({ username, role: "student" }, JWT_SECRET, { expiresIn: "24h" });
      res.json({ token, role: "student", username });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Middleware to verify JWT
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.warn("Auth failed: No token provided");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        console.error("Auth failed: Invalid token", err);
        return res.status(401).json({ error: "Invalid token" });
      }
      req.user = decoded;
      console.log(`[AUTH] User: ${req.user.username}, Role: ${req.user.role}, URL: ${req.url}`);
      next();
    });
  };

  // Middleware to verify Admin
  const adminOnly = (req: any, res: any, next: any) => {
    if (req.user.role !== "admin") {
      console.warn(`Admin access denied for user: ${req.user.username}`);
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };

  // 3. Companies
  app.get("/api/companies", authenticate, async (req, res) => {
    try {
      console.log("Fetching companies...");
      const snapshot = await getDocs(collection(db, "companies"));
      const companies = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(` - Company Doc ID: "${doc.id}", Name: "${data.name}"`);
        return { id: doc.id, ...data };
      });
      console.log(`Successfully fetched ${companies.length} companies`);
      res.json(companies);
    } catch (error) {
      console.error("Fetch companies error:", error);
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.post("/api/companies", authenticate, adminOnly, async (req, res) => {
    try {
      const { name } = req.body;
      console.log(`Creating company: ${name}`);
      const docRef = await addDoc(collection(db, "companies"), { name });
      console.log(`Company created with ID: ${docRef.id}`);
      res.json({ id: docRef.id, name });
    } catch (error: any) {
      console.error("Create company error FULL:", JSON.stringify({
        message: error.message,
        code: error.code,
        stack: error.stack
      }, null, 2));
      res.status(500).json({ error: "Failed to create company", details: error.message });
    }
  });

  app.delete("/api/companies/:id", authenticate, adminOnly, async (req, res) => {
    try {
      const id = req.params.id?.trim();
      if (!id) return res.status(400).json({ error: "Company ID is required" });
      
      console.log(`[ADMIN] LOG: Final ID for deletion after trim: "${id}"`);
      
      // Check if company exists first
      const companyRef = doc(db, "companies", id);
      console.log(`[ADMIN] Checking existence of path: companies/${id}`);
      const companyDoc = await getDocFromServer(companyRef).catch(err => {
        console.error(`[ADMIN] getDocFromServer failed for ${id}:`, err.message);
        return getDoc(companyRef);
      });
      
      if (!companyDoc.exists()) {
        console.warn(`[ADMIN] Delete failed: Company Doc "${id}" NOT FOUND in cache or server.`);
        return res.status(404).json({ error: `Company with ID ${id} not found` });
      }

      const q = query(collection(db, "questions"), where("companyId", "==", id));
      const snapshot = await getDocs(q);
      console.log(`[ADMIN] Found ${snapshot.size} questions to cascade delete.`);
      
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "questions", d.id)));
      await Promise.all(deletePromises);

      console.log(`[ADMIN] Deleting company document...`);
      await deleteDoc(companyRef);
      console.log(`[ADMIN] SUCCESS: Company ${id} and all related questions deleted.`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[ADMIN] CRITICAL ERROR during company deletion:", error);
      res.status(500).json({ error: `Server error: ${error.message}` });
    }
  });

  // 4. Questions
  app.get("/api/questions/:companyId", authenticate, async (req, res) => {
    try {
      const { companyId } = req.params;
      const q = query(collection(db, "questions"), where("companyId", "==", companyId));
      const snapshot = await getDocs(q);
      const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/questions", authenticate, adminOnly, async (req, res) => {
    try {
      const { companyId, title, difficulty, topic, leetcodeLink } = req.body;

      const finalLink = await findLeetCodeLink(title, leetcodeLink);

      const docRef = await addDoc(collection(db, "questions"), {
        companyId,
        title,
        difficulty,
        topic,
        leetcodeLink: finalLink,
        createdAt: serverTimestamp()
      });
      res.json({ id: docRef.id, title, leetcodeLink: finalLink });
    } catch (error) {
      console.error("Create question error:", error);
      res.status(500).json({ error: "Failed to create question" });
    }
  });

  app.delete("/api/questions/:id", authenticate, adminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      await deleteDoc(doc(db, "questions", id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete question" });
    }
  });

  // 5. User Progress
  app.get("/api/user/progress", authenticate, async (req: any, res) => {
    try {
      const userRef = doc(db, "users", req.user.username);
      const userDoc = await getDocFromServer(userRef).catch(() => getDoc(userRef));
      if (!userDoc.exists()) return res.status(404).json({ error: "User not found" });
      const data = userDoc.data();
      res.json({
        solvedQuestions: data?.solvedQuestions || [],
        revisionNeeded: data?.revisionNeeded || []
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  app.post("/api/user/progress", authenticate, async (req: any, res) => {
    try {
      const { questionId, status } = req.body; // status: 'solved', 'revision', 'reset'
      const userRef = doc(db, "users", req.user.username);
      const userDoc = await getDocFromServer(userRef).catch(() => getDoc(userRef));
      const userData = userDoc.data();

      let solved = new Set((userData?.solvedQuestions as string[]) || []);
      let revision = new Set((userData?.revisionNeeded as string[]) || []);
      let streak = userData?.streak || 0;
      let lastSolvedDate = userData?.lastSolvedDate; // YYYY-MM-DD
      const today = new Date().toISOString().split("T")[0];

      // Normalize status if needed (some versions of the frontend might send 'solved' or 'completed')
      const normalizedStatus = status === "completed" ? "solved" : status;

      if (normalizedStatus === "solved") {
        solved.add(questionId);
        revision.delete(questionId);

        // Streak logic
        if (lastSolvedDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];

          if (lastSolvedDate === yesterdayStr) {
            streak += 1;
          } else {
            streak = 1; // Reset or start new
          }
          lastSolvedDate = today;
        }
      } else if (status === "revision") {
        revision.add(questionId);
        solved.delete(questionId);
      } else {
        solved.delete(questionId);
        revision.delete(questionId);
      }

      await setDoc(userRef, {
        solvedQuestions: Array.from(solved),
        revisionNeeded: Array.from(revision),
        streak,
        lastSolvedDate
      }, { merge: true });

      res.json({ success: true, streak });
    } catch (error) {
      console.error("Update progress error:", error);
      res.status(500).json({ error: "Failed to update progress" });
    }
  });

  // 6. Stats
  app.get("/api/stats", authenticate, async (req: any, res) => {
    try {
      const questionsSnapshot = await getDocs(collection(db, "questions"));
      const totalQuestions = questionsSnapshot.size;
      
      const userRef = doc(db, "users", req.user.username);
      const userDoc = await getDocFromServer(userRef).catch(() => getDoc(userRef));
      
      const solved = (userDoc.exists() ? (userDoc.data()?.solvedQuestions as string[]) : [])?.length || 0;
      const revision = (userDoc.exists() ? (userDoc.data()?.revisionNeeded as string[]) : [])?.length || 0;
      const streak = (userDoc.exists() ? userDoc.data()?.streak : 0) || 0;
      
      res.json({
        totalQuestions,
        solvedQuestions: solved,
        revisionNeeded: revision,
        remainingQuestions: totalQuestions - solved,
        streak
      });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // 7. Admin - Users
  app.get("/api/admin/users", authenticate, adminOnly, async (req, res) => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          username: doc.id,
          email: data.email || "N/A",
          mobile: data.mobile || "N/A",
          streak: data.streak || 0,
          role: data.role
        };
      });
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Health check Firestore
    try {
      console.log("Checking Firestore connection...");
      await setDoc(doc(db, "_health", "check"), { lastStarted: new Date().toISOString() });
      console.log("Firestore connection OK");
    } catch (err: any) {
      console.error("Firestore connection FAILED on startup:", err.message);
    }
  });
}

startServer();

"use client";

import { useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/types/user";
import AuthModal from "@/components/auth/AuthModal";
import PendingScreen from "@/components/auth/PendingScreen";

interface AuthGateProps {
  children: ReactNode;
  classId?: string;
  classNameTitle?: string;
  schoolNameTitle?: string;
}

export default function AuthGate({
  children,
  classId = process.env.NEXT_PUBLIC_CLASS_ID || "kita2",
  classNameTitle,
  schoolNameTitle,
}: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Subscribe to user profile in Firestore
        const userDocRef = doc(db, "users", currentUser.uid);

        unsubscribeProfile = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error("User profile snapshot error:", err);
            setLoading(false);
          }
        );
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login/Register Gate
  if (!user) {
    return (
      <AuthModal
        classId={classId}
        classNameTitle={classNameTitle}
        schoolNameTitle={schoolNameTitle}
      />
    );
  }

  // Logged in but profile is still loading
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Admin or Approved user -> Full access
  if (profile.role === "admin" || profile.status === "approved") {
    return <>{children}</>;
  }

  // Pending or Rejected user -> Show Status Screen
  return <PendingScreen profile={profile} />;
}

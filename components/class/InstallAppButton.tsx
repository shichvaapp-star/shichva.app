"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Download,
  Share2,
  PlusSquare,
  X,
  Smartphone,
  Check,
  MoreHorizontal,
  Compass,
  Globe,
  Info,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getServerSnapshot() {
  return false;
}

export default function InstallAppButton() {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getServerSnapshot
  );

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);
  const [iosBrowserTab, setIosBrowserTab] = useState<"safari" | "chrome">("safari");

  // Check if device is iOS (iPhone/iPad)
  const isIOS =
    typeof window !== "undefined" &&
    (/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  // Check if browser is Chrome on iOS (CriOS)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes("crios")) {
        setIosBrowserTab("chrome");
      } else {
        setIosBrowserTab("safari");
      }
    }
  }, []);

  useEffect(() => {
    // Listen for Chrome/Android/Edge beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // If already running in standalone/installed mode, don't show the button
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalledSuccessfully(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error("Error triggering install prompt:", err);
        setShowModal(true);
      }
    } else {
      // For iOS or browsers where beforeinstallprompt isn't available
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer bg-primary/10 hover:bg-primary/20 text-foreground border border-primary/20 hover:border-primary/40 shadow-xs active:scale-95"
        title="התקן כאפליקציה בטלפון או במחשב"
        aria-label="התקן כאפליקציה"
      >
        {installedSuccessfully ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-500 font-semibold">הותקן בהצלחה</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>התקן אפליקציה</span>
          </>
        )}
      </button>

      {/* Instructions Modal / Bottom Sheet */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-card text-card-foreground border-t-2 sm:border-2 border-border shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              opacity: 1,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header (Sticky top) */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground leading-tight">
                    התקנת האפליקציה בטלפון
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    הוספה מהירה למסך הבית (30 שניות)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="סגור"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto px-5 py-4 space-y-4 text-sm">
              {isIOS ? (
                <div className="space-y-4">
                  {/* Browser Selector Tabs for iOS */}
                  <div className="flex rounded-xl p-1 bg-muted border border-border">
                    <button
                      type="button"
                      onClick={() => setIosBrowserTab("safari")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        iosBrowserTab === "safari"
                          ? "bg-card text-foreground shadow-xs border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Compass className="w-4 h-4 text-sky-500" />
                      <span>דפדפן Safari (ספארי)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIosBrowserTab("chrome")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        iosBrowserTab === "chrome"
                          ? "bg-card text-foreground shadow-xs border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Globe className="w-4 h-4 text-amber-500" />
                      <span>דפדפן כרום (Chrome)</span>
                    </button>
                  </div>

                  {/* Safari Instructions */}
                  {iosBrowserTab === "safari" && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                          1
                        </span>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm flex items-center flex-wrap gap-1.5">
                            לחצו על כפתור השיתוף
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold">
                              <Share2 className="w-3.5 h-3.5" />
                              שתף
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            נמצא בסרגל התחתון של המסך (סמל של ריבוע עם חץ למעלה).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                          2
                        </span>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm flex items-center flex-wrap gap-1.5">
                            גללו למטה ובחרו
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold">
                              <PlusSquare className="w-3.5 h-3.5" />
                              ״הוסף למסך הבית״
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            בתפריט שנפתח, גללו מעט למטה ברשימת האפשרויות.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                          3
                        </span>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm">
                            לחצו על ״הוסף״ (Add) בפינה העליונה
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            זהו! סמל האפליקציה נוסף למסך הבית וייפתח במסך מלא ללא דפדפן.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Chrome on iOS Instructions */}
                  {iosBrowserTab === "chrome" && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                          1
                        </span>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm flex items-center flex-wrap gap-1.5">
                            לחצו על כפתור 3 הנקודות
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                              תפריט
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            נמצא בפינה התחתונה של המסך (או ליד שורת הכתובת).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                          2
                        </span>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm flex items-center flex-wrap gap-1.5">
                            גללו ובחרו
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold">
                              <PlusSquare className="w-3.5 h-3.5" />
                              ״הוסף למסך הבית״
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            או לחצו על סמל השיתוף ובחרו ״הוסף למסך הבית״.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                          3
                        </span>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm">
                            לחצו על ״הוסף״ (Add)
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            האפליקציה תותקן מיידית על מסך הבית של האייפון שלכם.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp In-App Browser Helper Notice */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">
                      <strong>פתחתם דרך וואטסאפ?</strong> אם אינכם רואים את האפשרות, לחצו על סמל ה-
                      <strong>...</strong> בפינה העליונה ובחרו <strong>״פתח בספארי״ (Open in Safari)</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                /* Android / Desktop Browser Instructions */
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                      1
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground text-sm flex items-center flex-wrap gap-1.5">
                        לחצו על סמל ההתקנה
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-xs font-bold">
                          <Download className="w-3.5 h-3.5" />
                          התקן
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        נמצא בצד שורת הכתובת של הדפדפן (במחשב) או בתפריט 3 הנקודות בטלפון.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-muted/60 border border-border/80">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                      2
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold text-foreground text-sm">
                        אשרו את ההתקנה
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        האפליקציה תיפתח בחלון עצמאי ותתווסף לשולחן העבודה / מסך הבית.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="px-5 py-4 border-t border-border bg-card shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3 px-4 rounded-2xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer shadow-md"
              >
                הבנתי, תודה!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

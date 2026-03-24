import { getFunctions } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import { app as firebaseApp } from "./client";

// Export the Firebase Functions instance bound to the existing app
export const functions = getFunctions(firebaseApp, "us-central1");

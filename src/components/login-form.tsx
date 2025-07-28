"use client";

import { useState, type FormEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { generateVideo } from "@/ai/flows/video-generator";
import { Skeleton } from "@/components/ui/skeleton";
import { initialImage } from "@/lib/initial-image";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin") {
      onLoginSuccess();
    } else {
      setError("Invalid username or password. Please try again.");
    }
  };

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        const result = await generateVideo({
          prompt: "Make the baby look around gently.",
        });
        setVideoUrl(result.videoDataUri);
      } catch (error) {
        console.error("Error generating video background:", error);
        // Fallback to static image if video fails
        setVideoUrl(null); 
      } finally {
        setIsLoadingVideo(false);
      }
    };
    fetchVideo();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
        // This is to handle the case where the video is ready before the element is in the DOM
        video.play().catch(error => console.error("Autoplay was prevented:", error));
    }
  }, [videoUrl]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {isLoadingVideo && (
         <div className="absolute inset-0 z-0 bg-background flex items-center justify-center">
            <Skeleton className="w-full h-full" />
         </div>
      )}
      {!isLoadingVideo && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 w-auto min-w-full min-h-full max-w-none -translate-x-1/2 -translate-y-1/2 z-0 object-cover"
        />
      )}
      {!isLoadingVideo && !videoUrl && (
         <div 
          className="absolute top-1/2 left-1/2 w-auto min-w-full min-h-full max-w-none -translate-x-1/2 -translate-y-1/2 z-0 object-cover bg-cover"
          style={{ backgroundImage: `url(${initialImage})` }}
         />
      )}
      <div className="absolute inset-0 bg-black/50 z-10"></div>
      
      <div className="z-20 w-full max-w-md">
         <Card className="w-full shadow-2xl rounded-2xl border bg-card/80 backdrop-blur-sm transform transition-all duration-300 hover:scale-105">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-extrabold text-primary font-headline">
              Login
            </CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder=""
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-background/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/70"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center bg-destructive/20 p-2 rounded-md">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full text-lg py-6 font-semibold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transform hover:scale-105"
              >
                Login
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center justify-center text-xs text-muted-foreground pt-6">
            <p>AI powered @Firebase</p>
            <p>Created and Idea by: Ceman Dejamo Tudlasan</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

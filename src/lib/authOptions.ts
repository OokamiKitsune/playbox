import SpotifyProvider from "next-auth/providers/spotify";
import { JWT } from "next-auth/jwt";
import { NextAuthOptions, Profile} from "next-auth";
import { createClient} from "@supabase/supabase-js";

interface SpotifyProfile extends Profile {
    id: string;
    email: string;
    display_name: string;
    images: { url: string }[];
}
// Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
)
// Extend the Session type to include refreshToken and expiresAt
declare module "next-auth" {
    interface Session {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        supabaseUserId?: string;
        error?: string;
    }
}

// Extend the JWT type to include refreshToken and expiresAt
declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        supabaseUserId: string;
        error?: string;
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID!,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
            authorization:
                "https://accounts.spotify.com/authorize?scope=user-read-email,user-top-read,user-read-playback-state,user-read-recently-played",
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,

    callbacks: {
        async jwt({token, account, profile}) {
            console.log("JWT Callback Triggered")
            console.log("Token:", token);
            console.log("Refresh token:", token?.refreshToken);
            console.log("Account:", account);
            console.log("Profile:", profile);

            if (account && profile) {
                console.log("inital sign in detected.")
                const spotifyProfile = profile as SpotifyProfile;
                token.accessToken = account.access_token as string;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
                //token.expiresAt = Date.now() - 1000
                console.log("Spotify Profile:", spotifyProfile);
                console.log("Refresh:", token.refreshToken);

                if (!token.refreshToken) {
                    console.warn("No refresh token received during initial sign in.")
                    return token;
                }

                if (Date.now() >= (token.expiresAt || 0)) {
                    console.log("Access token expired. Attempting to refresh...");
                    token = await refreshAccessToken(token); // Call your refresh logic
                }





                // Check for email in Supabase
                const {data: existingUser} = await supabase
                    .from("users")
                    .select("email")
                    .eq("email", spotifyProfile.email)
                    .single();

                if (!existingUser) {
                    const {data, error: insertError} = await supabase
                        .from("users")
                        .insert({
                            email: spotifyProfile.email,
                            name: spotifyProfile.display_name,
                            image: spotifyProfile.images?.[0]?.url || "",
                        })
                        .select("id")
                        .single();

                    if (insertError) {
                        console.error("Failed to create user in Supabase:", insertError);
                    } else {
                        token.supabaseUserId = data.id;
                    }
                } else {
                    token.supabaseUserId = spotifyProfile.id;
                }
                // Handle expired tokens
                if (Date.now() < (token.expiresAt || 0)) {
                    return token;
                }

                console.log("Current time:", Date.now());
                console.log("Token expires at:", token.expiresAt);
                if (Date.now() >= (token.expiresAt || 0)) {
                    console.log("Token expired. Attempting to refresh...");
                    return refreshAccessToken(token);
                }


                // If access token has expired, refresh it
                return refreshAccessToken(token);
            }
            return token;
        },
        // Add the user to the session
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.refreshToken = token.refreshToken;
            session.expiresAt = token.expiresAt;
            session.error = token.error;
            return session;
        }


    },
}


async function refreshAccessToken(token: JWT): Promise<JWT> {
    try {
        console.log("Refresh access token:", token.accessToken);
        console.log("Refresh token:", token.refreshToken);
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString("base64")}`,
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: token.refreshToken as string,
            }),
        });

        const refreshedToken = await response.json();

        if (!response.ok) {
            throw new Error("Failed to refresh access token");
        }

        return {
            ...token,
            accessToken: refreshedToken.access_token,
            expiresAt: Date.now() + refreshedToken.expires_in * 1000, // Expiration time in ms
            refreshToken: refreshedToken.refresh_token || token.refreshToken, // Use new refresh token if provided
        };
    } catch (error) {
        console.error("Error refreshing access token:", error);

        return {
            ...token,
            error: "RefreshAccessTokenError",
        };
    }
}
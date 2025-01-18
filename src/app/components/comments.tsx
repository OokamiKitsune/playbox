import { useState, useEffect } from 'react';
import { addCommentToSong } from "@/app/supabase/addSong";
import { getCommentsForSong } from "@/app/supabase/addSong";
import AlertMessage from "@/app/components/AlertMessage";

interface CommentProps {
    spotifyId: string;
    track: string;
    userId: string;
}

interface Comment {
    users: string;
    comment: string;
    display_name: string;
    id: string;
    userId: string;
    text: string;
    createdAt: string; // Optional: For sorting, if your backend supports it
    count: number;
}

export default function Comments({ spotifyId, userId, track }: CommentProps) {
    const [commentText, setCommentText] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentSpotifyId, setCurrentSpotifyId] = useState(spotifyId);
    const [alertMessages, setAlertMessages] = useState<AlertMessage[]>([]);

    // Fetch comments on component mount or when spotifyId changes
    useEffect(() => {
        if (commentText.trim().length === 0) {
            // If user hasnt typed shit update the currentspotifyId
            setCurrentSpotifyId(spotifyId);
        }

        if (commentText.trim() !== '') {
            // Alert
           // setAlertMessages()
        } else {
            setCurrentSpotifyId(spotifyId); // Update only if comment in progress
        }
        async function loadComments() {
            try {
                setIsLoading(true);
                const fetchedComments = await getCommentsForSong(spotifyId);
                setComments(fetchedComments || []);
                console.log("Comments: ", fetchedComments);
            } catch (err) {
                console.error("Failed to load comments:", err);
            } finally {
                setIsLoading(false);
            }
        }

        loadComments();
    }, [spotifyId]);

    // Handle adding a new comment
    const handleClick = async () => {
        if (!commentText) return; // Prevent empty comments
        try {
            await addCommentToSong(userId, spotifyId, commentText);
            setCommentText('');

            // Optionally reload comments to show the new one
            const updatedComments = await getCommentsForSong(spotifyId);
            setComments(updatedComments || []);
        } catch (err) {
            console.error("Failed to add comment:", err);
        }
    };

    return (
        <div className="comments-section rounded p-10 max-w-3xl">
            <p className="text-gray-500 text-2xl">Comments </p>
    <p className="divider text-sm">{track}</p>
            {/* Comments list */}
            {isLoading ? (
                <p>Loading comments...</p>
            ) : comments.length > 0 ? (
                <div className="comments-list overflow-y-scroll max-h-60 pr-2">
                    <ul>
                        {comments.map((comment) => (
                            <li key={comment.id} className="mb-4">
                                <p className="text-lg text-purple-500 bg-gray-800 rounded">{comment.users?.name.toUpperCase() || "Anon"}: {comment.comment}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="text-sm">
                    <p>No comments on <strong>{track}</strong> yet.</p>


                </div>
            )}

            {/* Comment form */
            }
            <div>
                <textarea
                    style={{
                        resize: 'both',
                        maxWidth: '300px',
                        maxHeight: '300px',
                        minWidth: '300px',
                        minHeight: '200px'
                    }}
                    className="textarea textarea-lg max-h-50 bg-gray-700 mt-2"
                    placeholder="🎶 Comment on this track..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                ></textarea>
        <div className="">
            <button onClick={handleClick} className="btn btn-wide btn">Post</button>
        </div>
    </div>
</div>
)
    ;
}
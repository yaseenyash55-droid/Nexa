import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell.js';
import { ProfileHeader } from '../components/profile/ProfileHeader.js';
import { EditProfileModal } from '../components/profile/EditProfileModal.js';
import { PostCard } from '../components/feed/PostCard.js';
import { PostSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users.api.js';
import { postsApi } from '../api/posts.api.js';
import { socialApi } from '../api/social.api.js';
import { Grid, Film, List, Trash2, Heart, Play, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { getMediaUrl, handleImageError } from '../utils/media.js';
import { User } from '../types/index.js';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, setUser } = useAuth();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'posts' | 'grid' | 'reels'>('posts');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: user, isLoading: isUserLoading, isError } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getByUsername(username || '')
  });

  const { data: postsRes, isLoading: isPostsLoading } = useQuery({
    queryKey: ['user-posts', user?.userId],
    queryFn: () => postsApi.getFeed('global'),
    enabled: !!user?.userId
  });

  const { data: reelsList = [], isLoading: isReelsLoading } = useQuery({
    queryKey: ['reels'],
    queryFn: () => socialApi.getReels()
  });

  const userPosts = (postsRes?.data || []).filter((p) => p.userId === user?.userId);
  const userReels = reelsList.filter((r) => r.userId === user?.userId);

  const handleProfileUpdated = (updatedUser: User) => {
    if (currentUser && currentUser.userId === updatedUser.userId) {
      setUser(updatedUser);
    }
    // Seed new profile query cache immediately
    queryClient.setQueryData(['profile', updatedUser.username], updatedUser);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['user-posts'] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['suggestions'] });

    setSuccessMsg('Profile updated successfully!');
    setTimeout(() => setSuccessMsg(null), 5000);

    // If username changed, smoothly transition URL to the new username route
    if (username && username.toLowerCase() !== updatedUser.username.toLowerCase()) {
      navigate(`/profile/${updatedUser.username}`, { replace: true });
    }
  };

  if (isUserLoading) {
    return (
      <AppShell>
        <div className="p-4 space-y-4">
          <PostSkeleton />
        </div>
      </AppShell>
    );
  }

  if (isError || !user) {
    return (
      <AppShell>
        <EmptyState title="User not found" description="The profile you are looking for does not exist." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {successMsg && (
        <div className="m-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400/80 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ProfileHeader user={user} onEditClick={() => setIsEditModalOpen(true)} />

      <div className="p-4 space-y-4">
        {/* Profile Content Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setProfileTab('posts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              profileTab === 'posts'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Posts Feed ({userPosts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setProfileTab('grid')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              profileTab === 'grid'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Photo & Media Grid</span>
          </button>

          <button
            type="button"
            onClick={() => setProfileTab('reels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              profileTab === 'reels'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Film className="w-4 h-4 text-purple-300" />
            <span>Uploaded Bytes ({userReels.length})</span>
          </button>
        </div>

        {/* Tab 1: Posts Feed View */}
        {profileTab === 'posts' && (
          isPostsLoading ? (
            <PostSkeleton />
          ) : userPosts.length === 0 ? (
            <EmptyState title="No posts yet" description="This user hasn't published any posts yet." />
          ) : (
            <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl overflow-hidden">
              {userPosts.map((post) => (
                <PostCard key={post.postId} post={post} />
              ))}
            </div>
          )
        )}

        {/* Tab 2: Photo & Media Grid View */}
        {profileTab === 'grid' && (
          userPosts.filter((p) => p.imageUrl).length === 0 ? (
            <EmptyState title="No media uploads" description="This user has not uploaded any photos or media posts." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {userPosts
                .filter((p) => p.imageUrl)
                .map((post) => {
                  const mediaUrl = getMediaUrl(post.imageUrl);
                  return (
                    <div
                      key={post.postId}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800"
                    >
                      {mediaUrl && (
                        <img
                          src={mediaUrl}
                          alt="Grid thumbnail"
                          onError={handleImageError}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                        <div className="flex justify-end">
                          <span className="text-[10px] bg-black/70 text-white px-2 py-0.5 rounded-md font-mono">
                            #{post.postId}
                          </span>
                        </div>
                        <p className="text-xs text-white line-clamp-2 font-medium">{post.content || 'Photo Post'}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )
        )}

        {/* Tab 3: Uploaded Video Reels Grid View */}
        {profileTab === 'reels' && (
          isReelsLoading ? (
            <PostSkeleton />
          ) : userReels.length === 0 ? (
            <EmptyState title="No uploaded bytes" description="This user has not published any Bytes yet." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {userReels.map((reel) => {
                const videoSrc = getMediaUrl(reel.videoUrl) || reel.videoUrl;

                return (
                  <div
                    key={reel.reelId}
                    className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md"
                  >
                    <video src={videoSrc} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-purple-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 fill-current" /> Byte
                        </span>
                        {currentUser &&
                          (currentUser.userId === reel.userId || currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Delete this Byte?')) {
                                  socialApi.deleteReel(reel.reelId).then(() => {
                                    queryClient.invalidateQueries({ queryKey: ['reels'] });
                                  });
                                }
                              }}
                              className="p-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg transition-colors"
                              title="Delete Byte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium line-clamp-2">{reel.caption || 'Nexa Byte'}</p>
                        <div className="flex items-center gap-1 text-[10px] text-rose-400 mt-1">
                          <Heart className="w-3 h-3 fill-current" />
                          <span>{reel.likesCount || 0} likes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Modern Instagram-Style Edit Profile Modal */}
      {user && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={user}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </AppShell>
  );
};

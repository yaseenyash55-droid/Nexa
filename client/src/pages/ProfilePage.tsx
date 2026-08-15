import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell.js';
import { ProfileHeader } from '../components/profile/ProfileHeader.js';
import { PostCard } from '../components/feed/PostCard.js';
import { PostSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users.api.js';
import { postsApi } from '../api/posts.api.js';
import { socialApi } from '../api/social.api.js';
import { Upload, Image as ImageIcon, X, Crop as CropIcon, Grid, Film, List, MoreVertical, Trash2, Heart, Play } from 'lucide-react';
import { ImageCropperModal } from '../components/ui/ImageCropperModal.js';
import { useAuth } from '../contexts/AuthContext.js';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'posts' | 'grid' | 'reels'>('posts');

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  // Image Cropper state
  const [selectedRawProfileImage, setSelectedRawProfileImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading: isUserLoading, isError } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      const u = await usersApi.getByUsername(username || '');
      if (u) {
        setDisplayName(u.displayName || '');
        setBio(u.bio || '');
        setLocation(u.location || '');
        setWebsiteUrl(u.websiteUrl || '');
        setProfileImageUrl(u.profileImageUrl || '');
        setCoverImageUrl(u.coverImageUrl || '');
      }
      return u;
    }
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

  const userPosts = (postsRes?.data || []).filter(p => p.userId === user?.userId);
  const userReels = reelsList.filter(r => r.userId === user?.userId);

  const { user: currentUser, setUser } = useAuth();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      usersApi.updateProfile(user!.userId, {
        displayName,
        bio,
        location,
        websiteUrl,
        profileImageUrl,
        coverImageUrl
      }),
    onSuccess: (updatedUser) => {
      if (currentUser && currentUser.userId === user?.userId) {
        setUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setIsEditModalOpen(false);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  });

  // Handle direct file upload from local storage with crop support
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (target === 'profile') {
        setSelectedRawProfileImage(base64String);
        setIsCropperOpen(true);
      } else {
        setCoverImageUrl(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEditModal = () => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
      setWebsiteUrl(user.websiteUrl || '');
      setProfileImageUrl(user.profileImageUrl || '');
      setCoverImageUrl(user.coverImageUrl || '');
    }
    setIsEditModalOpen(true);
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
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400/80 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ProfileHeader user={user} onEditClick={handleOpenEditModal} />

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
            <span>Uploaded Reels ({userReels.length})</span>
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
              {userPosts.map(post => (
                <PostCard key={post.postId} post={post} />
              ))}
            </div>
          )
        )}

        {/* Tab 2: Photo & Media Grid View */}
        {profileTab === 'grid' && (
          userPosts.filter(p => p.imageUrl).length === 0 ? (
            <EmptyState title="No media uploads" description="This user has not uploaded any photos or media posts." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {userPosts.filter(p => p.imageUrl).map(post => {
                const src = post.imageUrl!.startsWith('/uploads') && window.location.origin.includes('surge.sh')
                  ? `https://pick-sims-regions-plaza.trycloudflare.com${post.imageUrl}`
                  : post.imageUrl!;
                return (
                  <div key={post.postId} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                    <img src={src} alt="Grid thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex justify-end">
                        <span className="text-[10px] bg-black/70 text-white px-2 py-0.5 rounded-md font-mono">#{post.postId}</span>
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
            <EmptyState title="No uploaded reels" description="This user has not published any video reels yet." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {userReels.map(reel => {
                const videoSrc = reel.videoUrl.startsWith('/uploads') && window.location.origin.includes('surge.sh')
                  ? `https://pick-sims-regions-plaza.trycloudflare.com${reel.videoUrl}`
                  : reel.videoUrl;

                return (
                  <div key={reel.reelId} className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
                    <video src={videoSrc} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-purple-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 fill-current" /> Reel
                        </span>
                        {currentUser && (currentUser.userId === reel.userId || [100, 101, 102].includes(currentUser.userId)) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Delete this reel from Oracle database?')) {
                                socialApi.deleteReel(reel.reelId).then(() => {
                                  queryClient.invalidateQueries({ queryKey: ['reels'] });
                                  alert('✔ Reel deleted successfully!');
                                });
                              }
                            }}
                            className="p-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg transition-colors"
                            title="Delete Reel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-white font-medium line-clamp-2">{reel.caption || 'Nexa Reel'}</p>
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

      {/* Edit Profile Modal with Direct Local Storage File Uploads */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Profile">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProfileMutation.mutate();
          }}
          className="space-y-5"
        >
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-background-card border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Input
              label="Website URL"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>

          {/* Local File Upload: Profile Avatar */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Profile Avatar Image
            </label>
            <input
              type="file"
              ref={profileFileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFileUpload(e, 'profile')}
            />
            <div className="flex items-center gap-4">
              {profileImageUrl ? (
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-brand-500">
                  <img src={profileImageUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setProfileImageUrl('')}
                    className="absolute top-0 right-0 bg-rose-600 text-white p-1 rounded-full"
                    title="Remove avatar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border border-slate-700">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => profileFileInputRef.current?.click()}
              >
                Upload Avatar File
              </Button>
            </div>
          </div>

          {/* Local File Upload: Cover Banner */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Cover Banner Image
            </label>
            <input
              type="file"
              ref={coverFileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFileUpload(e, 'cover')}
            />
            <div className="space-y-2">
              {coverImageUrl ? (
                <div className="relative h-28 w-full rounded-xl overflow-hidden border border-brand-500">
                  <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-full"
                    title="Remove cover image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="h-24 w-full rounded-xl bg-slate-900 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
                  <ImageIcon className="w-5 h-5" />
                  <span>No cover banner uploaded</span>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Upload className="w-4 h-4" />}
                onClick={() => coverFileInputRef.current?.click()}
              >
                Upload Cover Banner File
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateProfileMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Interactive Image Cropper Modal */}
      {selectedRawProfileImage && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          imageSrc={selectedRawProfileImage}
          onCropComplete={(croppedUrl) => {
            setProfileImageUrl(croppedUrl);
          }}
        />
      )}
    </AppShell>
  );
};

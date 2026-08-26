import React, { useState, useRef } from 'react';
import { User } from '../../types/index.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Avatar } from '../ui/Avatar.js';
import { ImageCropperModal } from '../ui/ImageCropperModal.js';
import { Camera, Image as ImageIcon, Loader2, Check, AlertCircle, Crop, AtSign } from 'lucide-react';
import { mediaApi } from '../../api/media.api.js';
import { usersApi } from '../../api/users.api.js';
import { getMediaUrl, handleImageError } from '../../utils/media.js';
import { useAuth } from '../../contexts/AuthContext.js';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onProfileUpdated: (updatedUser: User) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onProfileUpdated
}) => {
  const { setUser } = useAuth();
  const [username, setUsername] = useState(user.username || '');
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [location, setLocation] = useState(user.location || '');
  const [websiteUrl, setWebsiteUrl] = useState(user.websiteUrl || '');

  const [profileImageUrl, setProfileImageUrl] = useState(user.profileImageUrl || '');
  const [coverImageUrl, setCoverImageUrl] = useState(user.coverImageUrl || '');

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Manual Crop Modal State
  const [cropModalState, setCropModalState] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
    aspectRatio: number;
    cropShape: 'round' | 'rect';
    title: string;
    type: 'avatar' | 'cover';
  }>({
    isOpen: false,
    imageSrc: null,
    aspectRatio: 1,
    cropShape: 'round',
    title: 'Crop Image',
    type: 'avatar'
  });

  React.useEffect(() => {
    if (isOpen && user) {
      setUsername(user.username || '');
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
      setWebsiteUrl(user.websiteUrl || '');
      setProfileImageUrl(user.profileImageUrl || '');
      setCoverImageUrl(user.coverImageUrl || '');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setCropModalState({
      isOpen: true,
      imageSrc: objectUrl,
      aspectRatio: 1,
      cropShape: 'round',
      title: 'Crop Profile Photo (1:1)',
      type: 'avatar'
    });
    e.target.value = '';
  };

  const handleCoverFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setCropModalState({
      isOpen: true,
      imageSrc: objectUrl,
      aspectRatio: 2.5,
      cropShape: 'rect',
      title: 'Crop Cover Banner (Wide)',
      type: 'cover'
    });
    e.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File, _previewUrl: string) => {
    const isAvatar = cropModalState.type === 'avatar';
    try {
      if (isAvatar) {
        setIsUploadingAvatar(true);
        setErrorMsg(null);
        const uploadedUrl = await mediaApi.uploadFile(croppedFile, 'avatar');
        setProfileImageUrl(uploadedUrl);
        setSuccessMsg('Profile photo cropped and uploaded successfully!');
      } else {
        setIsUploadingCover(true);
        setErrorMsg(null);
        const uploadedUrl = await mediaApi.uploadFile(croppedFile, 'photo');
        setCoverImageUrl(uploadedUrl);
        setSuccessMsg('Cover banner cropped and uploaded successfully!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to upload ${isAvatar ? 'profile photo' : 'cover banner'}`);
    } finally {
      if (isAvatar) setIsUploadingAvatar(false);
      else setIsUploadingCover(false);
    }
  };

  const validateUsernameFormat = (val: string): string | null => {
    const clean = val.trim().toLowerCase();
    if (!clean) return 'Username is required';
    if (clean.length < 3) return 'Username must be at least 3 characters';
    if (clean.length > 30) return 'Username cannot exceed 30 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) return 'Username can only contain letters, numbers, and underscores';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const uErr = validateUsernameFormat(cleanUsername);
    if (uErr) {
      setErrorMsg(uErr);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const updated = await usersApi.updateProfile(user.userId, {
        username: cleanUsername,
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        websiteUrl: websiteUrl.trim(),
        profileImageUrl: profileImageUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined
      });

      // Synchronize in auth state and parent component
      setUser(updated);
      onProfileUpdated(updated);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to update profile';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const currentCoverUrl = getMediaUrl(coverImageUrl);
  const currentAvatarUrl = getMediaUrl(profileImageUrl);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Cover Banner Preview & Upload Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Cover Banner</label>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Crop className="w-3 h-3" /> Select & Crop Banner
              </button>
            </div>
            <div className="relative h-32 sm:h-40 rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 flex items-center justify-center group">
              {currentCoverUrl ? (
                <img
                  src={currentCoverUrl}
                  alt="Cover Banner"
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center space-y-1">
                  <ImageIcon className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-[11px] text-slate-500">No cover banner set</p>
                </div>
              )}

              {/* Banner Upload Overlay Button */}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold"
              >
                {isUploadingCover ? (
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                ) : (
                  <>
                    <Crop className="w-4 h-4" />
                    <span>Upload & Crop Banner</span>
                  </>
                )}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverFileSelected}
                className="hidden"
              />
            </div>
          </div>

          {/* 2. Avatar Photo Preview & Upload Area */}
          <div className="flex items-center gap-4 pt-1">
            <div className="relative group">
              <Avatar src={currentAvatarUrl} name={user.displayName} size="xl" />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                title="Change & Crop Profile Photo"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelected}
                className="hidden"
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Profile Photo</h3>
              <p className="text-xs text-slate-400">Square 1:1 manual crop (JPEG, PNG, WebP)</p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="mt-1.5 text-xs text-brand-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Crop className="w-3.5 h-3.5" />
                {isUploadingAvatar ? 'Uploading...' : 'Choose & Crop Photo'}
              </button>
            </div>
          </div>

          {/* 3. Text Fields */}
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                  <AtSign className="w-3.5 h-3.5 text-brand-400" />
                  <span>Username</span>
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="username"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">Letters, numbers, and underscores (3-30 chars)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Location</label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Website URL</label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || isUploadingAvatar || isUploadingCover}
            >
              {isSaving ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual Image Cropping Modal */}
      <ImageCropperModal
        isOpen={cropModalState.isOpen}
        onClose={() => setCropModalState((prev) => ({ ...prev, isOpen: false }))}
        imageSrc={cropModalState.imageSrc}
        aspectRatio={cropModalState.aspectRatio}
        cropShape={cropModalState.cropShape}
        title={cropModalState.title}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};

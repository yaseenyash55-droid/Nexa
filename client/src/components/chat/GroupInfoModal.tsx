import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Group, GroupMember, groupsApi } from '../../api/groups.api.js';
import { usersApi } from '../../api/users.api.js';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { Users, UserPlus, Trash2, LogOut, Shield, ShieldAlert, Check, X, Search, Settings } from 'lucide-react';
import { format } from 'date-fns';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onGroupUpdated?: (updatedGroup: Group) => void;
  onGroupDeleted?: () => void;
  onGroupLeft?: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  group,
  onGroupUpdated,
  onGroupDeleted,
  onGroupLeft
}) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [onlyAdminsPost, setOnlyAdminsPost] = useState(Boolean(group.onlyAdminsCanPost));

  // Sync state when group changes
  React.useEffect(() => {
    setOnlyAdminsPost(Boolean(group.onlyAdminsCanPost));
  }, [group]);

  // Fetch Group Members
  const { data: members = [], isLoading: isMembersLoading, refetch: refetchMembers } = useQuery<GroupMember[]>({
    queryKey: ['group-members', group.groupId],
    queryFn: () => groupsApi.getGroupMembers(group.groupId),
    enabled: isOpen
  });

  // Fetch all users for Add Members search
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['users-search', searchQuery],
    queryFn: () => usersApi.search(searchQuery),
    enabled: isOpen && isAddMemberOpen && searchQuery.trim().length > 0
  });

  const currentMember = members.find((m) => m.userId === currentUser?.userId);
  const isAdmin = currentMember?.role === 'ADMIN' || group.createdBy === currentUser?.userId;

  // Add members mutation
  const addMembersMutation = useMutation({
    mutationFn: (ids: number[]) => groupsApi.addGroupMembers(group.groupId, ids),
    onSuccess: () => {
      setSelectedUserIds([]);
      setIsAddMemberOpen(false);
      setSearchQuery('');
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: number) => groupsApi.removeGroupMember(group.groupId, targetUserId),
    onSuccess: () => {
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    }
  });

  // Leave group mutation
  const leaveGroupMutation = useMutation({
    mutationFn: () => groupsApi.leaveGroup(group.groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      onClose();
      onGroupLeft?.();
    }
  });

  // Update group settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: { onlyAdminsCanPost?: boolean }) =>
      groupsApi.updateGroupSettings(group.groupId, settings),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      onGroupUpdated?.(updated);
    }
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: () => groupsApi.deleteGroup(group.groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      onClose();
      onGroupDeleted?.();
    }
  });

  if (!isOpen) return null;

  const existingMemberIds = new Set(members.map((m) => m.userId));
  const eligibleUsers = allUsers.filter((u) => !existingMemberIds.has(u.userId));

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleAdminOnlyPost = (checked: boolean) => {
    setOnlyAdminsPost(checked);
    updateSettingsMutation.mutate({ onlyAdminsCanPost: checked });
  };

  const createdDate = group.createdAt ? new Date(group.createdAt) : new Date();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold shadow-glow-brand">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                {group.name}
              </h2>
              <p className="text-xs text-slate-400">
                Created {format(createdDate, 'MMMM d, yyyy')} • {members.length} members
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 bg-slate-900/20 px-5">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'members'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" /> Members ({members.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
                activeTab === 'settings'
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" /> Group Permissions & Settings
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'members' ? (
            <div className="space-y-4">
              {/* Add Member Bar (Admin / Creator) */}
              {isAdmin && !isAddMemberOpen && (
                <button
                  onClick={() => setIsAddMemberOpen(true)}
                  className="w-full p-3 rounded-2xl bg-brand-600/15 border border-brand-500/30 hover:bg-brand-600/25 transition-all text-xs font-bold text-brand-300 flex items-center justify-center gap-2 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" /> Add Members to Group
                </button>
              )}

              {/* Add Member Search Input & Dropdown */}
              {isAddMemberOpen && (
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Search & Select Users</span>
                    <button
                      onClick={() => {
                        setIsAddMemberOpen(false);
                        setSelectedUserIds([]);
                        setSearchQuery('');
                      }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by username or display name..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {eligibleUsers.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                      {eligibleUsers.map((u) => {
                        const isSelected = selectedUserIds.includes(u.userId);
                        return (
                          <div
                            key={u.userId}
                            onClick={() => toggleUserSelection(u.userId)}
                            className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                              isSelected ? 'bg-brand-600/20 border border-brand-500/40' : 'hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar src={u.profileImageUrl} name={u.displayName} size="sm" />
                              <div>
                                <p className="text-xs font-semibold text-white">{u.displayName}</p>
                                <p className="text-[10px] text-slate-400">@{u.username}</p>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-brand-400" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : searchQuery.trim().length > 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">No new users found matching '{searchQuery}'</p>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-2">Type a username above to search users</p>
                  )}

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={selectedUserIds.length === 0 || addMembersMutation.isPending}
                    isLoading={addMembersMutation.isPending}
                    onClick={() => addMembersMutation.mutate(selectedUserIds)}
                  >
                    Add {selectedUserIds.length} Selected Member{selectedUserIds.length > 1 ? 's' : ''}
                  </Button>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Group Roster</h4>
                {isMembersLoading ? (
                  <p className="text-xs text-slate-500 text-center py-4">Loading members...</p>
                ) : (
                  members.map((member) => {
                    const isSelf = member.userId === currentUser?.userId;
                    const isMemberAdmin = member.role === 'ADMIN';
                    const displayName = member.user?.displayName || `User #${member.userId}`;
                    const username = member.user?.username || `user_${member.userId}`;

                    return (
                      <div
                        key={member.userId}
                        className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between gap-3 hover:border-slate-700/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar src={member.user?.profileImageUrl} name={displayName} size="sm" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{displayName}</span>
                              {isSelf && <span className="text-[9px] text-slate-500 font-semibold">(You)</span>}
                              {isMemberAdmin && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                                  <Shield className="w-2.5 h-2.5" /> Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400">@{username}</p>
                          </div>
                        </div>

                        {/* Admin controls: Remove Member */}
                        {isAdmin && !isSelf && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove @${username} from this group?`)) {
                                removeMemberMutation.mutate(member.userId);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                            title="Remove from group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Admin-Only Posting Switch */}
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-bold text-white">Announcement Mode</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When enabled, only group admins can send messages. Non-admin members can only read messages.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={onlyAdminsPost}
                    onChange={(e) => handleToggleAdminOnlyPost(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>

              {/* Group Metadata Info */}
              <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Group ID</span>
                  <span className="font-mono text-white">#{group.groupId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Created By</span>
                  <span className="font-mono text-white">User #{group.createdBy}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Created Date</span>
                  <span className="text-white">{format(createdDate, 'PPP')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 flex items-center justify-between gap-2">
          {/* Leave Group Action */}
          {!confirmLeave ? (
            <button
              onClick={() => setConfirmLeave(true)}
              className="px-3.5 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave Group
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-rose-400 font-semibold">Are you sure?</span>
              <Button
                variant="danger"
                size="sm"
                isLoading={leaveGroupMutation.isPending}
                onClick={() => leaveGroupMutation.mutate()}
              >
                Confirm Leave
              </Button>
              <button
                onClick={() => setConfirmLeave(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Delete Group (Creator/Admin) */}
          {isAdmin && (
            <div>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-3.5 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Group
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-rose-500 font-bold">Irreversible!</span>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={deleteGroupMutation.isPending}
                    onClick={() => deleteGroupMutation.mutate()}
                  >
                    Confirm Delete
                  </Button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../api/client.js';
import { AppShell } from '../components/layout/AppShell.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Button } from '../components/ui/Button.js';
import { Bell, Heart, MessageSquare, UserPlus, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationApi.list();
      return res.data;
    }
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationsCount'] });
    }
  });

  const notifications = data?.data || [];
  const hasUnread = notifications.some((n: any) => n.isRead === 0);

  const getIcon = (type: string) => {
    switch (type) {
      case 'LIKE':
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />;
      case 'COMMENT':
        return <MessageSquare className="w-4 h-4 text-brand-400" />;
      case 'FOLLOW':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getActionText = (notif: any) => {
    switch (notif.type) {
      case 'LIKE':
        return 'liked your post';
      case 'COMMENT':
        return 'commented on your post';
      case 'FOLLOW':
        return 'started following you';
      default:
        return 'interacted with your profile';
    }
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
            <p className="text-xs text-slate-400">Stay updated on your interactions</p>
          </div>
          {hasUnread && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CheckCheck className="w-4 h-4" />}
              onClick={() => markAllMutation.mutate()}
              isLoading={markAllMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div className="p-6 bg-background-card border border-rose-500/20 rounded-2xl text-center space-y-3">
            <p className="text-sm text-rose-400 font-medium">Failed to load notifications</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="When people like, comment, or follow your account, notifications will appear here."
            icon={<Bell className="w-8 h-8 text-slate-500" />}
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((notif: any) => {
              const isUnread = notif.isRead === 0;
              return (
                <div
                  key={notif.notificationId}
                  onClick={() => {
                    if (isUnread) markReadMutation.mutate(notif.notificationId);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isUnread
                      ? 'bg-brand-950/20 border-brand-500/30 hover:border-brand-500/50'
                      : 'bg-background-card border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  <div className="p-2.5 bg-slate-800/80 rounded-xl flex items-center justify-center shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm text-slate-200">
                      <Link
                        to={`/profile/${notif.actor.username}`}
                        className="font-semibold text-white hover:underline mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {notif.actor.displayName || notif.actor.username}
                      </Link>
                      <span className="text-slate-400">{getActionText(notif)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {isUnread && (
                    <span className="w-2.5 h-2.5 bg-brand-500 rounded-full shrink-0 mt-2 shadow-sm shadow-brand-500/50" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { privacyApi } from '../../api/privacy.api.js';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'user' | 'post' | 'story' | 'reel';
  targetId: number | string;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetType, targetId }) => {
  const [reason, setReason] = useState<string>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericTargetId = Number(targetId);
    if (!numericTargetId || isNaN(numericTargetId)) {
      setErrorMessage('Invalid target identifier for reporting.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await privacyApi.submitReport({
        targetType,
        targetId: numericTargetId,
        reason,
        details: details.trim() || undefined
      });
      setIsSubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to submit report. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSubmitted(false);
    setDetails('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Report ${targetType.toUpperCase()}`}>
      {isSubmitted ? (
        <div className="py-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Report Submitted</h3>
          <p className="text-xs text-slate-300 max-w-xs mx-auto">
            Thank you for helping keep Nexa safe. Your report has been recorded in our moderation queue and will be reviewed by administrators.
          </p>
          <Button size="sm" onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Reports are confidential. The account user will not be notified of who reported them.</span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Reason for Report
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="spam">Spam or Scams</option>
              <option value="harassment">Harassment or Bullying</option>
              <option value="hate_speech">Hate Speech or Discrimination</option>
              <option value="violence">Violence or Dangerous Content</option>
              <option value="impersonation">Fake Account or Impersonation</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Additional Context (Optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Describe the issue in detail..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" isLoading={isSubmitting}>
              Submit Confidential Report
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

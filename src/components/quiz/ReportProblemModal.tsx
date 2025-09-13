import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { AlertTriangle, Flag } from 'lucide-react';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (problemDescription: string) => Promise<void>;
  questionText: string;
  answerText: string;
  isSubmitting: boolean;
}

export function ReportProblemModal({
  isOpen,
  onClose,
  onSubmit,
  questionText,
  answerText,
  isSubmitting,
}: ReportProblemModalProps) {
  const [problemDescription, setProblemDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!problemDescription.trim()) {
      setError('Please describe the problem.');
      return;
    }
    setError(null);
    await onSubmit(problemDescription);
    // Reset form after successful submission (handled by parent after onSubmit resolves)
    setProblemDescription('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report a Problem"
      maxWidth="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !problemDescription.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                <span>Report Problem</span>
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Question:</h3>
          <p className="text-gray-700 text-sm mb-3">{questionText}</p>
          <h3 className="font-medium text-gray-900 mb-2">Answer:</h3>
          <p className="text-gray-700 text-sm">{answerText}</p>
        </div>

        <div>
          <label htmlFor="problemDescription" className="block text-sm font-medium text-gray-700 mb-2">
            What is the problem?
          </label>
          <textarea
            id="problemDescription"
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
            placeholder="e.g., The answer is incorrect, there's a typo in the question, the points are wrong, etc."
            disabled={isSubmitting}
          />
        </div>

        <p className="text-sm text-gray-600">
          Your report will be reviewed by an administrator. Thank you for helping us improve!
        </p>
      </div>
    </Modal>
  );
}
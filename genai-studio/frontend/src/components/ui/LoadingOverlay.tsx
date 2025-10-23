import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  type?: 'spinner' | 'pulse' | 'bounce' | 'progress';
}

export default function LoadingOverlay({ 
  isVisible, 
  message = 'Loading...', 
  progress,
  type = 'spinner' 
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            {type === 'spinner' && <LoadingSpinner size="lg" />}
            {type === 'pulse' && <LoadingSpinner.LoadingPulse className="w-16 h-16 mx-auto" />}
            {type === 'bounce' && <LoadingSpinner.LoadingBounce className="justify-center" />}
            {type === 'progress' && progress !== undefined && (
              <LoadingSpinner.LoadingProgress progress={progress} className="w-32" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {message}
          </h3>
          {progress !== undefined && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {Math.round(progress)}% complete
            </p>
          )}
        </div>
      </div>
    </div>
  );
}



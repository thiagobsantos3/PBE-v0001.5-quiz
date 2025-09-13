import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { supabase } from '../../lib/supabase';
import { Modal } from '../common/Modal';
import { FormField } from '../common/FormField';
import { Button } from '../common/Button';
import { AlertMessage } from '../common/AlertMessage';
import { Announcement } from '../../types';
import {
  Users,
  User,
  Calendar,
  Save,
  Check,
  Bell
} from 'lucide-react';

interface AnnouncementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingAnnouncement: Announcement | null;
}

export function AnnouncementFormModal({
  isOpen,
  onClose,
  onSave,
  editingAnnouncement
}: AnnouncementFormModalProps) {
  const { user, developerLog } = useAuth();
  const { teamMembers } = useTeamManagement();
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'entire_team' | 'specific_members'>('entire_team');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'scheduled'>('active');
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when editing announcement changes
  useEffect(() => {
    if (editingAnnouncement) {
      setTitle(editingAnnouncement.title);
      setContent(editingAnnouncement.content);
      setTargetType(editingAnnouncement.target_type);
      setSelectedMembers(editingAnnouncement.target_members || []);
      setStartDate(editingAnnouncement.start_date ? 
        new Date(editingAnnouncement.start_date).toISOString().slice(0, 16) : '');
      setEndDate(editingAnnouncement.end_date ? 
        new Date(editingAnnouncement.end_date).toISOString().slice(0, 16) : '');
      setAttachmentUrl(editingAnnouncement.attachment_url || '');
      setStatus(editingAnnouncement.status as 'draft' | 'active' | 'scheduled');
    } else {
      // Reset form for new announcement
      setTitle('');
      setContent('');
      setTargetType('entire_team');
      setSelectedMembers([]);
      setStartDate('');
      setEndDate('');
      setAttachmentUrl('');
      setStatus('active');
    }
    setError(null);
  }, [editingAnnouncement]);

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAllMembers = () => {
    const memberIds = teamMembers.filter(m => m.role === 'member').map(m => m.userId);
    setSelectedMembers(memberIds);
  };

  const handleClearMembers = () => {
    setSelectedMembers([]);
  };

  const handleSave = async () => {
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Announcement title is required');
      return;
    }

    if (!content.trim()) {
      setError('Announcement content is required');
      return;
    }

    if (targetType === 'specific_members' && selectedMembers.length === 0) {
      setError('Please select at least one team member for targeted announcements');
      return;
    }

    if (!user?.teamId) {
      setError('Team information not available');
      return;
    }

    // Validate dates
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      setError('End date must be after start date');
      return;
    }

    try {
      setSaving(true);

      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        created_by: user.id,
        team_id: user.teamId,
        target_type: targetType,
        target_members: targetType === 'specific_members' ? selectedMembers : [],
        status,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        attachment_url: attachmentUrl.trim() || null,
      };

      if (editingAnnouncement) {
        // Update existing announcement
        const { error } = await supabase
          .from('announcements')
          .update({
            ...announcementData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAnnouncement.id);

        if (error) {
          console.error('❌ Error updating announcement:', error);
          throw error;
        }

        developerLog('✅ Announcement updated successfully');
      } else {
        // Create new announcement
        const { error } = await supabase
          .from('announcements')
          .insert([announcementData]);

        if (error) {
          console.error('❌ Error creating announcement:', error);
          throw error;
        }

        developerLog('✅ Announcement created successfully');
      }

      onSave(); // Refresh the announcements list
      onClose(); // Close the modal

    } catch (err: any) {
      console.error('💥 Error saving announcement:', err);
      setError(err.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  // Filter team members to only show members (not owners/admins)
  const availableMembers = teamMembers.filter(member => member.role === 'member');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}
      maxWidth="2xl"
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {editingAnnouncement ? 'Update Announcement' : 'Create Announcement'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <AlertMessage type="error" message={error} className="mb-4" />
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <FormField
            label="Announcement Title"
            id="announcementTitle"
            type="text"
            value={title}
            onChange={setTitle}
            placeholder="e.g., Weekly Study Schedule Update"
            required
          />
          
          <FormField
            label="Content"
            id="announcementContent"
            type="textarea"
            value={content}
            onChange={setContent}
            placeholder="Write your announcement content here..."
            rows={5}
            required
          />
        </div>

        {/* Targeting Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Target Audience</h3>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="targetType"
                value="entire_team"
                checked={targetType === 'entire_team'}
                onChange={(e) => setTargetType(e.target.value as 'entire_team')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">Entire Team</span>
              </div>
              <span className="text-sm text-gray-600">Send to all team members</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="targetType"
                value="specific_members"
                checked={targetType === 'specific_members'}
                onChange={(e) => setTargetType(e.target.value as 'specific_members')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900">Specific Members</span>
              </div>
              <span className="text-sm text-gray-600">Choose individual recipients</span>
            </label>
          </div>

          {/* Member Selection - Only show when specific members is selected */}
          {targetType === 'specific_members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Select Team Members
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllMembers}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearMembers}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              {availableMembers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No team members available</p>
                  <p className="text-sm text-gray-400">Team members with 'member' role will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {availableMembers.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => handleMemberToggle(member.userId)}
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                        selectedMembers.includes(member.userId)
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-indigo-600">
                          {member.user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{member.user.name}</div>
                        <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                      </div>
                      {selectedMembers.includes(member.userId) && (
                        <Check className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {selectedMembers.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scheduling Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <span>Scheduling (Optional)</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Start Date & Time"
              id="startDate"
              type="text"
              value={startDate}
              onChange={setStartDate}
              helpText="Leave empty to make announcement visible immediately"
            />
            
            <FormField
              label="End Date & Time"
              id="endDate"
              type="text"
              value={endDate}
              onChange={setEndDate}
              helpText="Leave empty for permanent announcement"
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Scheduling Tips:</p>
                <ul className="mt-1 space-y-1 text-blue-700">
                  <li>• Use start date to schedule announcements for future release</li>
                  <li>• Use end date to automatically archive time-sensitive announcements</li>
                  <li>• Leave both empty for immediate, permanent announcements</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Options */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Additional Options</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Status"
              id="announcementStatus"
              type="select"
              value={status}
              onChange={(val) => setStatus(val as 'draft' | 'active' | 'scheduled')}
              options={[
                { value: 'active', label: 'Active (Visible Now)' },
                { value: 'scheduled', label: 'Scheduled (Future Release)' },
                { value: 'draft', label: 'Draft (Not Visible)' }
              ]}
            />
            
            <FormField
              label="Attachment URL (Optional)"
              id="attachmentUrl"
              type="text"
              value={attachmentUrl}
              onChange={setAttachmentUrl}
              placeholder="https://example.com/document.pdf"
              helpText="Link to relevant documents or resources"
            />
          </div>
        </div>

        {/* Preview Section */}
        {(title || content) && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {title || 'Announcement Title'}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {content || 'Announcement content will appear here...'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>From: {user?.name}</span>
                    <span>•</span>
                    <span>To: {getTargetDisplay()}</span>
                    {startDate && (
                      <>
                        <span>•</span>
                        <span>Starts: {new Date(startDate).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );

  // Helper function to get target display text
  function getTargetDisplay(): string {
    if (targetType === 'entire_team') {
      return 'Entire Team';
    } else {
      const memberCount = selectedMembers.length;
      return `${memberCount} Member${memberCount !== 1 ? 's' : ''}`;
    }
  }
}
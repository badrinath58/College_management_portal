// Profile. Students can edit mobile + address and change their photo; everyone can change their password.
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import ProfileCard from '../../components/ProfileCard';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import RoleSwitch from '../../components/RoleSwitch';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import ChangePasswordForm from './ChangePasswordForm';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { http } from '../../services/api';
import { fileUrl, formatDate, humanize } from '../../utils/format';

function StudentProfile() {
  const toast = useToast();
  const { setProfile } = useAuth();
  const { data, loading, error, reload } = useFetch(() => http.get('/students/profile'), []);
  const [form, setForm] = useState({ mobile: '', address: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (data) setForm({ mobile: data.mobile || '', address: data.address || '' }); }, [data]);

  if (loading) return <LoadingSpinner label="Loading your profile..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  async function save(e) {
    e.preventDefault();
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) return setErrors({ mobile: 'Enter a 10 digit mobile number.' });
    setErrors({});
    setSaving(true);
    try { const body = await http.put('/students/profile', form); toast.success(body.message); reload(); }
    catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  async function uploadPhoto(file) {
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast.error('Please choose a .jpg or .png photo.');
    if (file.size > 2 * 1024 * 1024) return toast.error('The photo must be smaller than 2 MB.');
    const formData = new FormData();
    formData.append('photo', file);
    setUploading(true);
    try {
      const body = await http.post('/students/profile/photo', formData);
      setProfile((p) => ({ ...p, photo_path: body.data.photo_path, photo_url: fileUrl(body.data.photo_path) }));  // update the navbar picture too
      toast.success(body.message);
      reload();
    } catch (err) { toast.error(err.message); } finally { setUploading(false); }
  }

  const facts = [
    { label: 'Student ID', value: data.student_code }, { label: 'Email', value: data.email }, { label: 'Date of birth', value: formatDate(data.date_of_birth) },
    { label: 'Gender', value: humanize(data.gender) }, { label: 'Department', value: data.department }, { label: 'Course', value: data.course },
    { label: 'Year', value: data.current_year }, { label: 'Semester', value: data.semester }, { label: 'Section', value: data.section }, { label: 'Admission year', value: data.admission_year },
  ];
  return (
    <>
      <ProfileCard name={data.full_name} subtitle={`${data.course}`} photoUrl={fileUrl(data.photo_path)} facts={facts} onPhotoSelected={uploadPhoto} uploading={uploading} />
      <section className="card">
        <div className="card-header">Contact details</div>
        <form className="card-body form-grid" onSubmit={save} noValidate>
          <div className="full"><Alert type="info">You can change your mobile number and address. Other details can only be changed by the college office.</Alert></div>
          <Input label="Mobile" inputMode="numeric" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} error={errors.mobile} maxLength={10} />
          <div className="full"><Input label="Address" as="textarea" rows={3} value={form.address} maxLength={255} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          <div className="full"><Button type="submit" loading={saving}>Save changes</Button></div>
        </form>
      </section>
    </>
  );
}

function StaffProfile() {
  const { user, profile, role } = useAuth();
  const facts = [
    { label: 'Username', value: user.username }, { label: 'Email', value: user.email },
    ...(role === 'faculty' ? [{ label: 'Employee ID', value: profile?.employee_id }, { label: 'Department', value: profile?.department }] : []),
    { label: 'Designation', value: profile?.designation }, { label: 'Role', value: humanize(role) },
  ];
  return <ProfileCard name={profile?.full_name || user.username} subtitle={profile?.designation} facts={facts} />;
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" subtitle="Your details and account security." />
      <div className="stack">
        <RoleSwitch student={<StudentProfile />} faculty={<StaffProfile />} admin={<StaffProfile />} />
        <ChangePasswordForm />
      </div>
    </>
  );
}

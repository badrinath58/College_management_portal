// Shows a different page for each role on the SAME url.
//   <RoleSwitch student={<StudentAttendance />} faculty={<FacultyAttendance />} admin={...} />
// Roles without an entry get `fallback` (default: nothing).
import { useAuth } from '../context/AuthContext';

export default function RoleSwitch({ student, faculty, admin, fallback = null }) {
  const { role } = useAuth();
  const pick = { student, faculty, admin }[role];
  return pick ?? fallback;
}

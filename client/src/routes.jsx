// Every page of the app (except login and the three dashboards, which live in App.jsx).
// <RoleSwitch> shows a different screen per role on the SAME url. Keep `roles` in step with the
// backend (server/routes/*.js) and the sidebar menu (utils/menu.js).
import RoleSwitch from './components/RoleSwitch';
import BookSearch from './pages/BookSearch';
import CalendarPage from './pages/shared/CalendarPage';
import ProfilePage from './pages/shared/ProfilePage';
import TimetablePage from './pages/shared/TimetablePage';
import TransactionsPage from './pages/shared/TransactionsPage';
import ReceiptsPage from './pages/shared/ReceiptsPage';
// student screens
import StudentAttendance from './pages/student/StudentAttendance';
import Backlogs from './pages/student/Backlogs';
import ChooseTimetable from './pages/student/ChooseTimetable';
import StudentExams from './pages/student/StudentExams';
import FeeDetails from './pages/student/FeeDetails';
import GradeCardPage from './pages/student/GradeCardPage';
import HallTicketPage from './pages/student/HallTicketPage';
import HostelBooking from './pages/student/HostelBooking';
import LibraryBooks from './pages/student/LibraryBooks';
import StudentMarks from './pages/student/StudentMarks';
import OnlinePayment from './pages/student/OnlinePayment';
import AnswerSheets from './pages/student/AnswerSheets';
import StudentLessonPlans from './pages/student/StudentLessonPlans';
// faculty / admin screens
import AttendanceManage from './pages/staff/AttendanceManage';
import MarksManage from './pages/staff/MarksManage';
import ExamsManage from './pages/staff/ExamsManage';
import GradeCardsAdmin from './pages/staff/GradeCardsAdmin';
import HostelAdmin from './pages/staff/HostelAdmin';
import LessonPlansManage from './pages/staff/LessonPlansManage';
import TimetableAdmin from './pages/staff/TimetableAdmin';
import AnswerSheetsManage from './pages/staff/AnswerSheetsManage';
import BacklogsAdmin from './pages/staff/BacklogsAdmin';
import StudentsList from './pages/staff/StudentsList';
import StudentsAdmin from './pages/staff/StudentsAdmin';
import FacultyAdmin from './pages/staff/FacultyAdmin';
import AcademicSetup from './pages/staff/AcademicSetup';
import LibraryAdmin from './pages/staff/LibraryAdmin';

const ALL = ['student', 'faculty', 'admin'];
const SA = ['student', 'admin'];

export const moduleRoutes = [
  { path: '/calendar', roles: ALL, element: <CalendarPage /> },
  { path: '/attendance', roles: ALL, element: <RoleSwitch student={<StudentAttendance />} faculty={<AttendanceManage />} admin={<AttendanceManage />} /> },
  { path: '/backlogs', roles: SA, element: <RoleSwitch student={<Backlogs />} admin={<BacklogsAdmin />} /> },
  { path: '/books', roles: ALL, element: <BookSearch /> },
  { path: '/choose-timetable', roles: ['student'], element: <ChooseTimetable /> },
  { path: '/exams', roles: ALL, element: <RoleSwitch student={<StudentExams />} faculty={<ExamsManage />} admin={<ExamsManage />} /> },
  { path: '/fees', roles: SA, element: <FeeDetails /> },
  { path: '/grade-card', roles: SA, element: <RoleSwitch student={<GradeCardPage />} admin={<GradeCardsAdmin />} /> },
  { path: '/hall-ticket', roles: ['student'], element: <HallTicketPage /> },
  { path: '/hostel', roles: SA, element: <RoleSwitch student={<HostelBooking />} admin={<HostelAdmin />} /> },
  { path: '/lesson-plans', roles: ALL, element: <RoleSwitch student={<StudentLessonPlans />} faculty={<LessonPlansManage />} admin={<LessonPlansManage />} /> },
  { path: '/library', roles: ['student'], element: <LibraryBooks /> },
  { path: '/marks', roles: ALL, element: <RoleSwitch student={<StudentMarks />} faculty={<MarksManage />} admin={<MarksManage />} /> },
  { path: '/payment', roles: ['student'], element: <OnlinePayment /> },
  { path: '/transactions', roles: SA, element: <TransactionsPage /> },
  { path: '/profile', roles: ALL, element: <ProfilePage /> },
  { path: '/receipts', roles: SA, element: <ReceiptsPage /> },
  { path: '/timetable', roles: ALL, element: <RoleSwitch student={<TimetablePage />} faculty={<TimetablePage />} admin={<TimetableAdmin />} /> },
  { path: '/answer-sheets', roles: ALL, element: <RoleSwitch student={<AnswerSheets />} faculty={<AnswerSheetsManage />} admin={<AnswerSheetsManage />} /> },
  { path: '/students', roles: ['faculty'], element: <StudentsList /> },
  { path: '/admin/students', roles: ['admin'], element: <StudentsAdmin /> },
  { path: '/admin/faculty', roles: ['admin'], element: <FacultyAdmin /> },
  { path: '/admin/academics', roles: ['admin'], element: <AcademicSetup /> },
  { path: '/admin/library', roles: ['admin'], element: <LibraryAdmin /> },
];

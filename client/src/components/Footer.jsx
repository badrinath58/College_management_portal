import { COLLEGE_NAME } from '../utils/config';

export default function Footer() {
  return <footer className="footer">&copy; {new Date().getFullYear()} {COLLEGE_NAME}. All rights reserved.</footer>;
}

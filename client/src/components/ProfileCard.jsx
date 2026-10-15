// Photo + name + key facts. Pass onPhotoSelected to show a "Change photo" button.
import { Fragment, useRef } from 'react';
import { Camera } from 'lucide-react';
import Avatar from './Avatar';
import Button from './Button';

export default function ProfileCard({ name, subtitle, photoUrl, facts = [], onPhotoSelected, uploading }) {
  const fileInput = useRef(null);
  return (
    <section className="card card-body profile-head">
      <div className="stack" style={{ alignItems: 'center', gap: 10 }}>
        <Avatar name={name} src={photoUrl} size={110} />
        {onPhotoSelected && (
          <>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg" className="sr-only" aria-label="Choose a profile photo"
              onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onPhotoSelected(f); }} />
            <Button variant="secondary" size="sm" icon={<Camera size={15} />} loading={uploading} onClick={() => fileInput.current.click()}>Change photo</Button>
          </>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <h2>{name}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        <dl className="kv" style={{ marginTop: 10 }}>
          {facts.map((f) => <Fragment key={f.label}><dt>{f.label}</dt><dd>{f.value ?? '-'}</dd></Fragment>)}
        </dl>
      </div>
    </section>
  );
}

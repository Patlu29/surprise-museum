import { useRef, useState, type DragEvent } from 'react';
import { LIMITS } from '@contract';
import { announce } from '@/state/announcer';
import { useBuilderStore } from '@/state/builderStore';
import { FIELD_IDS } from '@/state/draft';
import { addFiles } from '@/state/uploadQueue';
import { Alert } from '@/ui/components/Alert';
import { Button } from '@/ui/components/Button';
import { DemoNotice } from '@/ui/components/DemoNotice';
import { FrameMark } from '@/ui/components/FrameMark';
import { StepSection } from '@/ui/components/StepSection';
import { PhotoRow } from './PhotoRow';
import { SECTION } from './stepCopy';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

/**
 * Step 1: add, order and caption the photos (FR-2 to FR-6, design spec 2.1 and 5.4). Files are
 * validated by content, rejected ones are listed with a reason, and valid ones carry on.
 */
export function PhotosStep() {
  const photos = useBuilderStore((state) => state.photos);
  const rejections = useBuilderStore((state) => state.rejections);
  const dismissRejections = useBuilderStore((state) => state.dismissRejections);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [dropping, setDropping] = useState(false);
  const full = photos.length >= LIMITS.maxPhotos;

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    void addFiles(list).then(() =>
      announce(`${list.length} ${list.length === 1 ? 'file' : 'files'} selected`),
    );
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropping(false);
    handleFiles(event.dataTransfer.files);
  };

  const percent = Math.min(100, Math.round((photos.length / LIMITS.maxPhotos) * 100));

  return (
    <div className="step-sections">
      <DemoNotice context="builder" />

      {rejections.length > 0 ? (
        <Alert
          tone="danger"
          title={`${rejections.length} ${rejections.length === 1 ? "file wasn't" : "files weren't"} added`}
          onDismiss={dismissRejections}
        >
          <ul>
            {rejections.map((item) => (
              <li key={item.id}>
                <span className="user-text">{item.fileName}</span>: {item.reason}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <StepSection title={SECTION.photos} tag="required" note={SECTION.photosNote}>
        <div
          className={[
            'dropzone',
            photos.length === 0 && 'is-empty',
            dropping && 'is-dropping',
          ]
            .filter(Boolean)
            .join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              event.target.value = '';
              handleFiles(files);
            }}
          />
          {photos.length === 0 ? (
            <>
              <span className="dropzone__mark" aria-hidden="true">
                <FrameMark />
              </span>
              <p className="dropzone__title">No photos yet</p>
            </>
          ) : null}
          <Button
            id={FIELD_IDS.photos}
            variant="primary"
            large
            icon="plus"
            className="dropzone__add"
            unavailable={full}
            aria-describedby="photo-count"
            onClick={() => inputRef.current?.click()}
          >
            Add photos
          </Button>
          <p id="photo-count" className="dropzone__count muted">
            {full
              ? `You can add up to ${LIMITS.maxPhotos} photos. Remove one to add another.`
              : `${photos.length} of ${LIMITS.maxPhotos} photos`}
          </p>
          <span className="meter" aria-hidden="true">
            <span className="meter__fill" style={{ width: `${percent}%` }} />
          </span>
          <p className="dropzone__drag muted" aria-hidden="true">
            or drag photos here
          </p>
        </div>

        {photos.length > 0 ? (
          <>
            <p className="muted">
              Photos hang along the museum from the entrance to the finale, in this order.
            </p>
            <ol ref={listRef} className="photo-list" aria-label="Your photos">
              {photos.map((photo, index) => (
                <PhotoRow
                  key={photo.localId}
                  photo={photo}
                  index={index}
                  total={photos.length}
                  listRef={listRef}
                />
              ))}
            </ol>
            {!full ? (
              <div>
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() => inputRef.current?.click()}
                >
                  Add more photos
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </StepSection>
    </div>
  );
}

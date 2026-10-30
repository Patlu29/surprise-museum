import { describe, expect, it } from 'vitest';
import { AVATAR_GENDERS, AVATAR_OPTIONS } from '@contract';
import {
  areaAnnouncement,
  directionPhrase,
  failedPhotoAnnouncement,
  finaleAnnouncement,
  galleryCount,
  hintAnnouncement,
  jumpAnnouncement,
  presentationAnnouncement,
  sceneDescription,
} from './announcements';
import {
  AVATAR_LABELS,
  avatarOptionLabel,
  avatarsEqual,
  DEFAULT_GUIDE_AVATAR,
  DEFAULT_VISITOR_AVATAR,
  describeAvatar,
  optionIds,
  selectedGender,
} from './avatars';
import {
  DEFAULT_GUIDE_APPEARANCE,
  DEFAULT_VISITOR_APPEARANCE,
  SKIN_LABELS,
} from '@/domain/characters/avatarOptions';
import { contrastRatio, parseHexColor, pickReadableInk } from './contrast';
import { cssDurationMs, parseCssTimeMs } from './css';
import { detectInAppBrowser } from './inAppBrowser';
import { buildHashUrl, editUrl, isEditToken, isShareToken, shareUrl } from './links';

describe('announcements', () => {
  it('announces a caption with the Guide, the photo number and the text', () => {
    expect(presentationAnnouncement('Tom', 2, 12, 'We found this place.')).toBe(
      'Tom, photo 3 of 12: We found this place.',
    );
  });

  it('falls back to "Photo n of N" with no caption (FR-63)', () => {
    expect(presentationAnnouncement('Tom', 2, 12, '   ')).toBe('Photo 3 of 12');
  });

  it('has the fixed sentences from the spec', () => {
    expect(finaleAnnouncement('Tom')).toBe('Finale. Tom is sharing a note.');
    expect(areaAnnouncement('entrance', 0, 3)).toBe('Entrance hall');
    expect(areaAnnouncement('gallery', 2, 3)).toBe('Gallery 2 of 3');
    expect(areaAnnouncement('finale', 0, 3)).toBe('Finale room');
    expect(failedPhotoAnnouncement(2)).toBe('Photo 3 did not load. A Retry button is available.');
    expect(jumpAnnouncement(2, 12)).toBe('Moved to photo 3 of 12');
  });

  it('counts galleries like the layout: four pictures a room, one to five rooms', () => {
    expect(galleryCount(1)).toBe(1);
    expect(galleryCount(4)).toBe(1);
    expect(galleryCount(5)).toBe(2);
    expect(galleryCount(12)).toBe(3);
    expect(galleryCount(20)).toBe(5);
  });

  it('describes the scene on Start', () => {
    expect(sceneDescription('A museum for Sophie', 'Tom', 12)).toBe(
      'You are in the entrance hall of A museum for Sophie. 12 pictures hang along 3 galleries, leading to a finale room. Tom, your guide, is beside you. Walk freely. Pause by a picture and Tom will tell you about it.',
    );
    expect(sceneDescription('T', 'Tom', 1)).toContain('1 picture hangs along a gallery');
  });

  it('turns a bearing into words', () => {
    expect(directionPhrase(0)).toBe('ahead');
    expect(directionPhrase(90)).toBe('on your right');
    expect(directionPhrase(180)).toBe('behind you');
    expect(directionPhrase(270)).toBe('on your left');
    expect(directionPhrase(315)).toBe('ahead on your left');
    expect(directionPhrase(-90)).toBe('on your left');
  });

  it('describes a hint', () => {
    expect(
      hintAnnouncement(
        {
          target: { kind: 'photo', photoId: 'a' },
          bearingDeg: 315,
          distanceM: 9.2,
          onScreen: false,
        },
        3,
        12,
        'Tom',
      ),
    ).toBe("Nearest picture you haven't seen: photo 4 of 12, about 9 metres ahead on your left");
    expect(
      hintAnnouncement(
        { target: { kind: 'finale' }, bearingDeg: 0, distanceM: 1, onScreen: true },
        -1,
        12,
        'Tom',
      ),
    ).toContain('finale');
  });
});

describe('avatars', () => {
  it('has a label for every option id in the contract', () => {
    for (const [key, ids] of Object.entries(AVATAR_OPTIONS)) {
      if (key === 'glasses' || key === 'hat') continue;
      const labels = AVATAR_LABELS[key as keyof typeof AVATAR_LABELS] as Record<string, string>;
      for (const id of ids) expect(labels[id], `${key}:${id}`).toBeTruthy();
    }
  });

  it('meets the minimum option counts (FR-13, FR-14)', () => {
    expect(AVATAR_OPTIONS.skinTone.length).toBeGreaterThanOrEqual(8);
    expect(AVATAR_OPTIONS.hairStyle.length).toBeGreaterThanOrEqual(8);
    expect(AVATAR_OPTIONS.hairColor.length).toBeGreaterThanOrEqual(8);
    expect(AVATAR_OPTIONS.outfitStyle.length).toBeGreaterThanOrEqual(5);
    expect(AVATAR_OPTIONS.bodyType.length).toBeGreaterThanOrEqual(3);
    expect(AVATAR_OPTIONS.height.length).toBeGreaterThanOrEqual(3);
    expect(AVATAR_OPTIONS.facialHair.length - 1).toBeGreaterThanOrEqual(3);
  });

  it('describes a character in words, using the shared domain helper', () => {
    expect(describeAvatar(DEFAULT_GUIDE_AVATAR, 'Tom')).toBe(
      'Tom: medium height, regular build, short crop dark brown hair, navy shirt and trousers.',
    );
    expect(describeAvatar({ ...DEFAULT_GUIDE_AVATAR, facialHair: 'goatee' }, 'Sam')).toContain(
      'goatee',
    );
    expect(describeAvatar(DEFAULT_VISITOR_AVATAR)).toMatch(/^Medium height, regular build/);
  });

  it('shares its defaults and labels with the domain, so there is one source of truth', () => {
    expect(DEFAULT_GUIDE_AVATAR).toBe(DEFAULT_GUIDE_APPEARANCE);
    expect(DEFAULT_VISITOR_AVATAR).toBe(DEFAULT_VISITOR_APPEARANCE);
    expect(AVATAR_LABELS.skinTone).toBe(SKIN_LABELS);
  });

  it('compares avatars by value', () => {
    expect(avatarsEqual(DEFAULT_GUIDE_AVATAR, { ...DEFAULT_GUIDE_AVATAR })).toBe(true);
    expect(avatarsEqual(DEFAULT_GUIDE_AVATAR, DEFAULT_VISITOR_AVATAR)).toBe(false);
  });

  it('treats a missing gender as neutral and different from the other genders (ADR 0020)', () => {
    const { gender: _ignored, ...legacy } = DEFAULT_GUIDE_AVATAR;
    expect(avatarsEqual(legacy, { ...legacy, gender: 'neutral' })).toBe(true);
    expect(avatarsEqual({ ...legacy, gender: 'neutral' }, legacy)).toBe(true);
    expect(avatarsEqual(legacy, { ...legacy, gender: 'feminine' })).toBe(false);
    expect(avatarsEqual({ ...legacy, gender: 'feminine' }, legacy)).toBe(false);
    expect(
      avatarsEqual({ ...legacy, gender: 'masculine' }, { ...legacy, gender: 'feminine' }),
    ).toBe(false);
    expect(avatarsEqual(legacy, { ...legacy, hairStyle: 'afro' })).toBe(false);
  });

  it('offers Woman, Man and Neutral in that order, and defaults to Neutral', () => {
    expect(optionIds('gender')).toEqual([...AVATAR_GENDERS]);
    expect(optionIds('gender').map((id) => avatarOptionLabel('gender', id))).toEqual([
      'Woman',
      'Man',
      'Neutral',
    ]);
    expect(selectedGender(DEFAULT_GUIDE_AVATAR)).toBe('neutral');
    expect(selectedGender(DEFAULT_VISITOR_AVATAR)).toBe('neutral');
    expect(selectedGender({ ...DEFAULT_GUIDE_AVATAR, gender: 'nonsense' as never })).toBe(
      'neutral',
    );
  });

  it('shows the body type labels Wider hips and Wider shoulders without changing ids', () => {
    expect(avatarOptionLabel('bodyType', 'curvy')).toBe('Wider hips');
    expect(avatarOptionLabel('bodyType', 'broad')).toBe('Wider shoulders');
    expect(AVATAR_OPTIONS.bodyType).toContain('curvy');
    expect(AVATAR_OPTIONS.bodyType).toContain('broad');
  });
});

describe('contrast', () => {
  it('parses hex and computes the WCAG ratio', () => {
    expect(parseHexColor('#ffffff')).toEqual([255, 255, 255]);
    expect(parseHexColor('nope')).toBeNull();
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });

  it('picks ink that reads on the background', () => {
    const ink: [number, number, number] = [0x2a, 0x1f, 0x26];
    const paper: [number, number, number] = [0xfb, 0xf6, 0xee];
    expect(pickReadableInk([0x26, 0x3a, 0x66], ink, paper)).toBe('light'); // navy
    expect(pickReadableInk([0xef, 0xe3, 0xcc], ink, paper)).toBe('dark'); // cream
  });
});

describe('css time parsing', () => {
  it('reads milliseconds and seconds', () => {
    expect(parseCssTimeMs('400ms')).toBe(400);
    expect(parseCssTimeMs(' 0.4s ')).toBe(400);
    expect(parseCssTimeMs('0ms')).toBe(0);
    expect(parseCssTimeMs('fast')).toBeNull();
  });

  it('falls back outside a browser', () => {
    expect(cssDurationMs('--duration-fast', 150)).toBe(150);
  });
});

describe('in-app browsers', () => {
  it('detects common messaging apps and ignores real browsers', () => {
    expect(
      detectInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Instagram 300.0'),
    ).toBe('Instagram');
    expect(detectInAppBrowser('Mozilla/5.0 [FBAN/FBIOS;FBAV/450.0]')).toBe('Facebook');
    expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14) MicroMessenger/8.0')).toBe('WeChat');
    expect(detectInAppBrowser('Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1')).toBeNull();
    expect(
      detectInAppBrowser('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36'),
    ).toBeNull();
  });
});

describe('links', () => {
  const base = 'https://patlu29.github.io/surprise-museum/';
  const share = 'abcdefghijklmnopqrstuvwx';
  const edit = 'A'.repeat(43);

  it('builds hash links, with the token only after the #', () => {
    expect(shareUrl(share, base)).toBe(`${base}#/m/${share}`);
    expect(editUrl(edit, base)).toBe(`${base}#/edit/${edit}`);
    expect(buildHashUrl(`${base}#/old`, '/m/x')).toBe(`${base}#/m/x`);
  });

  it('validates token shapes before any request', () => {
    expect(isShareToken(share)).toBe(true);
    expect(isShareToken('short')).toBe(false);
    expect(isShareToken(undefined)).toBe(false);
    expect(isEditToken(edit)).toBe(true);
    expect(isEditToken(share)).toBe(false);
  });
});

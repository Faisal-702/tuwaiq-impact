export type ProjectStatus = "draft" | "published";
export type MediaKind = "image" | "video" | "document" | "link";
export type CategoryKind = "project" | "activity";

export type CategoryRef = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  icon: string;
  accent: string;
};

export type Category = CategoryRef & {
  keywords: string;
  kind: CategoryKind;
  sort_order: number;
  archived_at: string | null;
  project_count?: number;
};

export type StudentRef = {
  id: string;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
};

export type MediaImage = {
  thumb: string;
  large: string;
  original: string;
  width: number | null;
  height: number | null;
};

export type ProjectCardData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  grade: number | null;
  points: number;
  view_count: number;
  is_featured: boolean;
  award: string | null;
  published_at: string | null;
  category: CategoryRef;
  students: StudentRef[];
  cover: { url: string; width: number | null; height: number | null } | null;
};

export type ProjectMedia = {
  id: string;
  kind: MediaKind;
  position: number;
  caption: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  url: string | null;
  original_url: string | null;
  preview_url: string | null;
  thumb_url: string | null;
  storage_path: string | null;
  preview_path: string | null;
  thumb_path: string | null;
};

export type ProjectDetail = ProjectCardData & {
  class_name: string | null;
  academic_year: string | null;
  supervisor: string | null;
  status: ProjectStatus;
  cover_media_id: string | null;
  created_at: string;
  updated_at: string;
  students: (StudentRef & { grade: number | null })[];
  media: ProjectMedia[];
};

export type LeaderboardRow = {
  rank: number;
  id: string;
  slug: string;
  name_en: string | null;
  name_ar: string | null;
  grade: number | null;
  points: number;
  projects: number;
};

export type HomeStats = {
  projects: number;
  students: number;
  awards: number;
  activities: number;
};

export type ProjectSort = "newest" | "views" | "points" | "active";
export type ContentTypeFilter = "image" | "video" | "document" | "link" | "text";

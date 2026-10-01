import { ArrowLeft, Award, CalendarDays, Eye, ExternalLink, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { CategoryChip } from "@/components/ui/chip";
import { Reveal } from "@/components/ui/reveal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatDate, formatNumber, gradeLabel, localName } from "@/i18n/format";
import type { ProjectCardData, ProjectDetail } from "@/lib/types";
import { safeHttpUrl } from "@/lib/utils";
import { ProjectCard } from "../project-card";
import { Attachments } from "./attachments";
import { CopyLinkButton } from "./copy-link";
import { Gallery } from "./gallery";
import { VideoPlayer } from "./video-player";

function Paragraphs({ text }: { text: string }) {
  // Plain text only — user content is never rendered as HTML.
  return (
    <>
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} dir="auto" className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </>
  );
}

export function ProjectView({
  project,
  related,
  t,
  locale,
  preview,
}: {
  project: ProjectDetail;
  related: ProjectCardData[];
  t: Dictionary;
  locale: Locale;
  preview?: boolean;
}) {
  const images = project.media
    .filter((m) => m.kind === "image" && m.original_url)
    .map((m) => ({
      id: m.id,
      original: m.original_url!,
      large: m.preview_url ?? m.original_url!,
      thumb: m.thumb_url ?? m.preview_url ?? m.original_url!,
      width: m.width,
      height: m.height,
      caption: m.caption,
    }));
  // Put the chosen cover first.
  if (project.cover_media_id) {
    const idx = images.findIndex((i) => i.id === project.cover_media_id);
    if (idx > 0) images.unshift(...images.splice(idx, 1));
  }
  const videos = project.media.filter((m) => m.kind === "video" && m.original_url);
  const documents = project.media.filter((m) => m.kind === "document" && m.original_url);
  const links = project.media
    .filter((m) => m.kind === "link")
    .map((m) => ({ ...m, safe: safeHttpUrl(m.url) }))
    .filter((m) => m.safe);
  const category = locale === "ar" ? project.category.name_ar : project.category.name_en;

  const details: { label: string; value: React.ReactNode }[] = [
    {
      label: project.students.length > 1 ? t.project.students : t.project.student,
      value: (
        <ul className="space-y-1">
          {project.students.map((s) => (
            <li key={s.id}>
              {preview ? (
                localName(s, locale)
              ) : (
                <Link href={`/students/${s.slug}`} className="text-ink underline-offset-4 hover:text-purple hover:underline">
                  {localName(s, locale)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ),
    },
    ...(project.grade ? [{ label: t.project.grade, value: gradeLabel(project.grade, t.grades.label) }] : []),
    ...(project.class_name ? [{ label: t.project.className, value: <span dir="auto">{project.class_name}</span> }] : []),
    { label: t.project.category, value: category },
    ...(project.academic_year ? [{ label: t.project.academicYear, value: <span dir="auto">{project.academic_year}</span> }] : []),
    ...(project.supervisor ? [{ label: t.project.supervisor, value: <span dir="auto">{project.supervisor}</span> }] : []),
    ...(project.published_at ? [{ label: t.project.published, value: formatDate(project.published_at, locale) }] : []),
    { label: t.project.points, value: formatNumber(project.points, locale) },
  ];

  return (
    <article className="pb-8">
      {preview ? (
        <div className="border-b border-purple/15 bg-lavender-soft">
          <p className="container-page flex items-center gap-2 py-3 text-sm font-medium text-purple-ink">
            <Eye className="size-4" aria-hidden />
            {t.project.previewBanner}
            {project.status === "draft" ? (
              <span className="ms-2 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-purple/20">{t.project.draftBadge}</span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="container-page pt-8 sm:pt-10">
        {!preview ? (
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:translate-x-0.5" aria-hidden />
            {t.project.backToProjects}
          </Link>
        ) : null}

        <Reveal y={10}>
          <header className="mt-6 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip name={category} icon={project.category.icon} accent={project.category.accent} />
              {project.is_featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-lavender-soft px-2.5 py-1 text-xs font-semibold text-purple-ink ring-1 ring-inset ring-purple/15">
                  <Star className="size-3.5 fill-purple text-purple" aria-hidden />
                  {t.projects.featured}
                </span>
              ) : null}
              {project.award ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf6e7] px-2.5 py-1 text-xs font-medium text-[#8a6413] ring-1 ring-inset ring-[#e9cf8f]/70">
                  <Award className="size-3.5" aria-hidden />
                  <span dir="auto">{project.award}</span>
                </span>
              ) : null}
            </div>
            <h1 dir="auto" className="mt-5 text-[2.125rem] font-bold leading-[1.12] tracking-[-0.025em] text-ink sm:text-5xl rtl:tracking-normal">
              {project.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9375rem] text-muted">
              <p className="text-ink-soft">
                {project.students.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 ? (i === project.students.length - 1 ? (locale === "ar" ? " و" : " & ") : locale === "ar" ? "، " : ", ") : null}
                    <span className="font-medium text-ink">{localName(s, locale)}</span>
                  </span>
                ))}
                {project.grade ? <span> · {gradeLabel(project.grade, t.grades.label)}</span> : null}
              </p>
              {project.published_at ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {formatDate(project.published_at, locale)}
                </span>
              ) : null}
              {!preview ? (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-4" aria-hidden />
                  {formatNumber(project.view_count, locale)} {t.common.views}
                </span>
              ) : null}
            </div>
          </header>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-12 lg:col-span-8">
            {images.length > 0 ? (
              <Reveal>
                <section aria-label={t.project.gallery}>
                  <Gallery images={images} title={project.title} />
                </section>
              </Reveal>
            ) : null}

            {videos.length > 0 ? (
              <section aria-labelledby="video-heading" className="space-y-4">
                <h2 id="video-heading" className="text-xl font-semibold text-ink">
                  {t.project.video}
                </h2>
                {videos.map((v) => (
                  <div key={v.id}>
                    <VideoPlayer src={v.original_url!} poster={v.thumb_url} mimeType={v.mime_type} title={v.caption || project.title} />
                    {v.caption ? (
                      <p dir="auto" className="mt-2 text-sm text-muted">
                        {v.caption}
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-xl font-semibold text-ink">
                {t.project.about}
              </h2>
              <div className="mt-4 max-w-3xl space-y-4 text-[1.0625rem] leading-[1.8] text-ink-soft">
                {project.description?.trim() ? (
                  <Paragraphs text={project.description} />
                ) : (
                  <p className="text-muted">{t.project.noDescription}</p>
                )}
              </div>
            </section>

            {documents.length > 0 ? (
              <section aria-labelledby="attachments-heading">
                <h2 id="attachments-heading" className="text-xl font-semibold text-ink">
                  {t.project.attachments}
                </h2>
                <div className="mt-4">
                  <Attachments
                    items={documents.map((d) => ({
                      id: d.id,
                      url: d.original_url!,
                      fileName: d.file_name ?? "document",
                      mimeType: d.mime_type,
                      size: d.size_bytes,
                      caption: d.caption,
                    }))}
                  />
                </div>
              </section>
            ) : null}

            {links.length > 0 ? (
              <section aria-labelledby="links-heading">
                <h2 id="links-heading" className="text-xl font-semibold text-ink">
                  {t.project.links}
                </h2>
                <ul className="mt-4 space-y-2">
                  {links.map((l) => (
                    <li key={l.id}>
                      <a
                        href={l.safe!}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-line-soft transition hover:ring-line"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint-soft text-teal-deep">
                          <ExternalLink className="size-4.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="block truncate font-medium text-ink group-hover:text-purple">
                            {l.caption || new URL(l.safe!).hostname}
                          </span>
                          <span dir="ltr" className="block truncate text-sm text-muted">
                            {l.safe}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
              <div className="rounded-[1.5rem] bg-white p-6 shadow-soft ring-1 ring-line-soft">
                <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Sparkles className="size-4 text-teal" aria-hidden />
                  {t.project.details}
                </h2>
                <dl className="mt-5 divide-y divide-line-soft">
                  {details.map((d) => (
                    <div key={d.label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-4 py-3 text-[0.9375rem]">
                      <dt className="text-muted">{d.label}</dt>
                      <dd className="font-medium text-ink">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {!preview ? <CopyLinkButton /> : null}
            </div>
          </aside>
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-24">
            <h2 id="related-heading" className="text-2xl font-bold tracking-tight text-ink">
              {t.project.related.replace("{category}", category)}
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} t={t} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useIntersectionLazyLoad } from "@/hooks/use-intersection-lazy-load";

export type CourseCardData = {
  id: string;
  title: string;
  instructor: string;
  category: string;
  lessons: number;
  duration: string;
  thumbnailUrl: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  rating: number;
};

type CourseCardProps = {
  course?: CourseCardData;
  isLoading?: boolean;
};

function formatRating(rating: number) {
  return rating.toFixed(1);
}

export function CourseCardSkeleton() {
  return (
    <article className="animate-pulse overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="aspect-[16/9] w-full bg-slate-200" />
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-24 rounded-full bg-slate-200" />
          <div className="h-5 w-16 rounded-full bg-slate-200" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-11/12 rounded-lg bg-slate-200" />
          <div className="h-6 w-7/12 rounded-lg bg-slate-200" />
        </div>
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-14 rounded-2xl bg-slate-100" />
          <div className="h-14 rounded-2xl bg-slate-100" />
          <div className="h-14 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </article>
  );
}

export function CourseCard({ course, isLoading = false }: CourseCardProps) {
  const { isNearViewport, targetRef } = useIntersectionLazyLoad<HTMLElement>({
    rootMargin: "260px"
  });
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [course?.thumbnailUrl]);

  if (isLoading || !course) {
    return <CourseCardSkeleton />;
  }

  return (
    <article
      ref={targetRef}
      className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {!imageLoaded ? <div className="absolute inset-0 animate-pulse bg-slate-200" /> : null}

        {isNearViewport ? (
          <Image
            alt={course.title}
            className={`h-full w-full object-cover transition duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            fill
            onLoad={() => setImageLoaded(true)}
            sizes="(max-width: 768px) 100vw, 33vw"
            src={course.thumbnailUrl}
          />
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {course.category}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{course.level}</span>
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{course.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{course.instructor}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Lessons</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{course.lessons}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Duration</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{course.duration}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Rating</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatRating(course.rating)}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

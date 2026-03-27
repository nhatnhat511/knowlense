import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { CourseCard, CourseCardSkeleton, type CourseCardData } from "@/components/course/course-card";

const courses: CourseCardData[] = [
  {
    id: "course-1",
    title: "Product Research Systems for TPT Sellers",
    instructor: "Knowlense Academy",
    category: "Research",
    lessons: 18,
    duration: "3h 20m",
    thumbnailUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80",
    level: "Beginner",
    rating: 4.8
  },
  {
    id: "course-2",
    title: "Listing Optimization and Conversion Review",
    instructor: "Knowlense Academy",
    category: "Optimization",
    lessons: 24,
    duration: "4h 05m",
    thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    level: "Intermediate",
    rating: 4.9
  },
  {
    id: "course-3",
    title: "Scaling Store Operations with Better Workflow Design",
    instructor: "Knowlense Academy",
    category: "Operations",
    lessons: 16,
    duration: "2h 45m",
    thumbnailUrl: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80",
    level: "Advanced",
    rating: 4.7
  }
];

export default function CourseCardDemoPage() {
  return (
    <main className="app-shell">
      <SiteHeader
        tag="Course card demo"
        navItems={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/pricing", label: "Pricing" },
          { href: "/account", label: "Account" }
        ]}
      />

      <section className="shell marketing-surface space-y-10">
        <div className="section-heading">
          <span className="section-label">Lazy Load + Skeleton</span>
          <h1 className="page-title">Course card loading states with lazy thumbnails.</h1>
          <p className="page-copy">
            The skeleton matches the final card structure, while the thumbnail loads only when the card comes near the
            viewport.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <CourseCardSkeleton />
          <CourseCardSkeleton />
          <CourseCardSkeleton />
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard course={course} key={course.id} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

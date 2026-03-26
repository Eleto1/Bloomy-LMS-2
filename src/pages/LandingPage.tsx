import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, BookOpen, Award, ChevronRight, BarChart3, Shield, Zap } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">Bloomy<span className="text-secondary">Tech</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#programs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Programs</a>
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link to="/login">
              <Button variant="hero" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden gradient-hero">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-secondary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 text-secondary mb-6 text-sm font-medium animate-fade-in">
              <Zap className="w-4 h-4" /> Lagos' Premier Tech Training Institute
            </div>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl text-primary-foreground leading-tight mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Launch Your Tech Career with{' '}
              <span className="text-gradient">Bloomy Technologies</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Master in-demand tech skills with hands-on training, expert instructors, and a supportive learning community. From web development to data science — your future starts here.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Link to="/login">
                <Button variant="hero" size="xl">
                  Start Learning Today <ChevronRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="hero-outline" size="xl">
                  View Programs
                </Button>
              </Link>
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {[
              { value: '2,500+', label: 'Students Trained' },
              { value: '50+', label: 'Expert Instructors' },
              { value: '30+', label: 'Tech Courses' },
              { value: '95%', label: 'Job Placement' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10">
                <div className="font-display font-bold text-2xl md:text-3xl text-secondary">{stat.value}</div>
                <div className="text-sm text-primary-foreground/60 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
              Everything You Need to <span className="text-gradient">Succeed</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our comprehensive platform empowers students, instructors, and administrators with powerful tools.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: 'Interactive Courses', desc: 'Structured learning paths with video content, quizzes, and hands-on projects.' },
              { icon: Users, title: 'Cohort-Based Learning', desc: 'Learn alongside peers in organized cohorts with scheduled classes and milestones.' },
              { icon: BarChart3, title: 'Progress Tracking', desc: 'Real-time analytics and grade tracking to monitor your learning journey.' },
              { icon: Award, title: 'Certifications', desc: 'Earn verifiable certificates upon course completion to showcase your skills.' },
              { icon: Shield, title: 'Expert Instructors', desc: 'Learn from industry professionals with years of real-world experience.' },
              { icon: Zap, title: 'Community', desc: 'Join a vibrant community of learners to collaborate and network.' },
            ].map((feature) => (
              <div key={feature.title} className="group p-6 rounded-2xl border border-border bg-card hover:shadow-brand transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
              Popular <span className="text-gradient">Programs</span>
            </h2>
            <p className="text-muted-foreground text-lg">Explore our most in-demand tech training programs</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { title: 'Full-Stack Web Development', duration: '16 Weeks', level: 'Beginner to Advanced', color: 'from-blue-600 to-blue-800' },
              { title: 'Data Science & Analytics', duration: '12 Weeks', level: 'Intermediate', color: 'from-emerald-500 to-emerald-700' },
              { title: 'Mobile App Development', duration: '14 Weeks', level: 'Beginner to Advanced', color: 'from-orange-500 to-red-600' },
            ].map((program) => (
              <div key={program.title} className="rounded-2xl overflow-hidden bg-card shadow-brand">
                <div className={`h-40 bg-gradient-to-br ${program.color} flex items-center justify-center p-6`}>
                  <h3 className="font-display font-bold text-xl text-primary-foreground text-center">{program.title}</h3>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>⏱ {program.duration}</span>
                    <span>📊 {program.level}</span>
                  </div>
                  <Link to="/login">
                    <Button variant="default" className="w-full">Enroll Now</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-primary-foreground mb-4">
            Ready to Start Your Tech Journey?
          </h2>
          <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
            Join thousands of students who have transformed their careers with Bloomy Technologies.
          </p>
          <Link to="/login">
            <Button variant="hero" size="xl">
              Apply Now <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-foreground">Bloomy Technologies</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Bloomy Technologies. Lagos, Nigeria. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

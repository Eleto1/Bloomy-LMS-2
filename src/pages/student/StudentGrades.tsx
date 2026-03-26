import DashboardLayout from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';

const courses = [
  {
    name: 'Full-Stack Web Development',
    grades: [
      { item: 'Assignment 1: HTML/CSS', score: 85, max: 100, weight: '10%' },
      { item: 'Assignment 2: JavaScript', score: 92, max: 100, weight: '10%' },
      { item: 'Midterm Exam', score: 78, max: 100, weight: '30%' },
      { item: 'React Portfolio', score: null, max: 100, weight: '20%' },
      { item: 'Final Project', score: null, max: 100, weight: '30%' },
    ],
    overall: 85,
    letter: 'A',
  },
  {
    name: 'Database Design & SQL',
    grades: [
      { item: 'SQL Fundamentals Quiz', score: 88, max: 100, weight: '15%' },
      { item: 'Data Visualization Lab', score: 92, max: 100, weight: '20%' },
      { item: 'Midterm Exam', score: 90, max: 100, weight: '30%' },
      { item: 'Final Project', score: null, max: 100, weight: '35%' },
    ],
    overall: 90,
    letter: 'A',
  },
];

const StudentGrades = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display font-bold text-2xl text-foreground">My Grades</h2>
        <p className="text-muted-foreground text-sm">Track your academic performance</p>
      </div>

      {courses.map((c) => (
        <Card key={c.name} className="border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h3 className="font-display font-semibold text-foreground">{c.name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Overall:</span>
              <span className={`font-display font-bold text-lg ${c.overall >= 80 ? 'text-success' : c.overall >= 60 ? 'text-warning' : 'text-destructive'}`}>
                {c.letter} ({c.overall}%)
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assessment</th>
                  <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="text-center p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weight</th>
                </tr>
              </thead>
              <tbody>
                {c.grades.map((g) => (
                  <tr key={g.item} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-4 text-sm text-foreground">{g.item}</td>
                    <td className="p-4 text-sm text-center">
                      {g.score !== null ? (
                        <span className={`font-semibold ${g.score >= 80 ? 'text-success' : g.score >= 60 ? 'text-warning' : 'text-destructive'}`}>
                          {g.score}/{g.max}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-center text-muted-foreground">{g.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  </DashboardLayout>
);

export default StudentGrades;

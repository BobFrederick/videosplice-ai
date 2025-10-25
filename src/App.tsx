import { useState } from 'react'
import { Brain } from '@phosphor-icons/react'
import { Toaster } from '@/components/ui/sonner'
import { ProjectView } from '@/components/ProjectView'
import { SettingsDialog } from '@/components/SettingsDialog'
import { BullMQQueue } from '@/components/BullMQQueue'
import type { Project } from '@/lib/types'
import { useLocalStorage } from '@/hooks/useLocalStorage'

function App() {
  const [projects, setProjects] = useLocalStorage<Project[]>('video-projects', [])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)

  const projectsList = Array.isArray(projects) ? projects : []
  const currentProject = projectsList.find((p) => p.id === currentProjectId)

  const handleBackToJobs = () => {
    setCurrentProjectId(null)
  }

  const handleViewProject = async (projectId: string, job?: any) => {
    // First, try to find an existing project by ID
    let existingProject = projectsList.find(p => p.id === projectId)
    
    // If not found by ID, try to find by jobId
    if (!existingProject) {
      existingProject = projectsList.find(p => p.jobId === projectId)
    }
    
    if (existingProject) {
      setCurrentProjectId(existingProject.id)
      return
    }

    // If no existing project found, try to create one from job data
    if (job) {
      console.log('Creating project from job data:', job)
      console.log('Job returnvalue:', job.returnvalue)
      console.log('Job data:', job.data)
      
      try {
        // Try to fetch job results from server if returnvalue is missing
        let jobResults = job.returnvalue
        if (!jobResults && job.id) {
          console.log('Fetching job results from server for:', job.id)
          try {
            const response = await fetch(`http://localhost:8080/api/jobs/${job.id}`)
            if (response.ok) {
              const jobData = await response.json()
              console.log('Fetched job data:', jobData)
              jobResults = jobData.returnvalue
            }
          } catch (error) {
            console.log('Failed to fetch job results:', error)
          }
        }
        
        const newProject: Project = {
          id: jobResults?.projectId || job.id,
          name: job.data?.fileName || `Project ${job.id}`,
          jobId: job.id,
          segments: jobResults?.segments || [],
          transcript: jobResults?.transcript || 'Processing results not available',
          videoUrl: jobResults?.videoUrl || job.data?.videoUrl,
          duration: jobResults?.duration || job.data?.duration || 0,
          exportedSegments: jobResults?.exportedSegments || []
        }
        
        console.log('Creating new project:', newProject)
        
        // Add the new project to the projects list
        setProjects(currentProjects => {
          const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
          return [...existingProjects, newProject]
        })
        
        // Navigate to the new project
        setCurrentProjectId(newProject.id)
        return
        
      } catch (error) {
        console.error('Failed to create project from job data:', error)
      }
    }
    
    console.log('No project found for ID:', projectId)
    console.log('Available projects:', projectsList.map(p => ({ id: p.id, jobId: p.jobId, name: p.name })))
  }

  // If viewing a specific project, show the project view
  if (currentProject) {
    return (
      <ProjectView 
        project={currentProject} 
        onBack={handleBackToJobs}
        onProjectUpdate={(updatedProject) => {
          setProjects(currentProjects => {
            const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
            return existingProjects.map(p => 
              p.id === updatedProject.id ? updatedProject : p
            )
          })
        }}
      />
    )
  }

  // Show the main BullMQ queue interface
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-purple-600 rounded-xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              VideoSplice AI
            </h1>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Intelligent video segmentation powered by local AI with BullMQ job queue system.
          </p>
        </div>

        <div className="flex items-center justify-end mb-6">
          <SettingsDialog />
        </div>

        <BullMQQueue onViewProject={handleViewProject} />

        <Toaster />
      </div>
    </div>
  )
}

export default App
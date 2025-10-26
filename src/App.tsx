import { useState } from 'react'
import { Brain } from '@phosphor-icons/react'
import { Toaster } from '@/components/ui/sonner'
import { ProjectView } from '@/components/ProjectView'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BullMQQueue } from '@/components/BullMQQueue'
import type { Project } from '@/lib/types'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useTheme } from '@/hooks/useTheme'

function App() {
  // Initialize theme
  useTheme()
  
  const [projects, setProjects] = useLocalStorage<Project[]>('video-projects', [])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)

  const projectsList = Array.isArray(projects) ? projects : []
  const currentProject = projectsList.find((p) => p.id === currentProjectId)

  const handleBackToJobs = () => {
    setCurrentProjectId(null)
  }

  const handleViewProject = async (projectId: string, job?: any) => {
    console.log('🔍 DEBUG: handleViewProject called with:', { projectId, hasJob: !!job })
    console.log('🔍 DEBUG: Current projects list:', projectsList.map(p => ({ id: p.id, name: p.name, segments: p.segments?.length })))
    
    // First, try to find an existing project by ID
    let existingProject = projectsList.find(p => p.id === projectId)
    
    // If not found by ID, try to find by jobId
    if (!existingProject) {
      existingProject = projectsList.find(p => p.jobId === projectId)
    }
    
    // If we found an existing project but it has no segments and we have fresh job data, update it
    if (existingProject && job?.returnvalue && (!existingProject.segments || existingProject.segments.length === 0)) {
      console.log('🔍 DEBUG: Found existing project with no segments, updating with fresh job data')
      console.log('🔍 DEBUG: Job returnvalue has segments:', job.returnvalue.segments?.length || 0)
      
      try {
        const updatedProject: Project = {
          ...existingProject,
          name: job.data?.fileName || job.returnvalue?.fileName || existingProject.name,
          segments: job.returnvalue.segments || [],
          transcript: job.returnvalue.transcript || existingProject.transcript,
          videoUrl: `http://localhost:8080/api/video/${job.id}`,
          duration: job.returnvalue.duration || job.data?.duration || existingProject.duration
        }
        
        console.log('🔍 DEBUG: Updated project:', updatedProject)
        console.log('🔍 DEBUG: Updated project segments:', updatedProject.segments?.length || 0)
        
        // Update the project in the list
        setProjects(currentProjects => {
          const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
          return existingProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
        })
        
        setCurrentProjectId(updatedProject.id)
        return
      } catch (error) {
        console.error('Failed to update project with fresh data:', error)
      }
    }
    
    if (existingProject) {
      console.log('🔍 DEBUG: Found existing project:', existingProject)
      setCurrentProjectId(existingProject.id)
      return
    }

    // If no existing project found, try to create one from job data
    if (job) {
      console.log('🔍 DEBUG: Creating project from job data:', job)
      console.log('🔍 DEBUG: Job returnvalue:', job.returnvalue)
      console.log('🔍 DEBUG: Job data:', job.data)
      
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
          name: job.data?.fileName || jobResults?.fileName || `Project ${job.id}`,
          jobId: job.id,
          segments: jobResults?.segments || [],
          transcript: jobResults?.transcript || 'Processing results not available',
          videoUrl: `http://localhost:8080/api/video/${job.id}`,
          duration: jobResults?.duration || job.data?.duration || 0,
          exportedSegments: jobResults?.exportedSegments || []
        }
        
        console.log('🔍 DEBUG: Creating new project:', newProject)
        console.log('🔍 DEBUG: Project segments count:', newProject.segments?.length || 0)
        console.log('🔍 DEBUG: Project segments detail:', newProject.segments)
        console.log('🔍 DEBUG: Project video URL:', newProject.videoUrl)
        
        // Add the new project to the projects list
        setProjects(currentProjects => {
          const existingProjects = Array.isArray(currentProjects) ? currentProjects : []
          const updatedProjects = [...existingProjects, newProject]
          console.log('🔍 DEBUG: Updated projects list:', updatedProjects.map(p => ({ id: p.id, name: p.name, segments: p.segments?.length })))
          return updatedProjects
        })
        
        // Navigate to the new project
        console.log('🔍 DEBUG: Setting current project ID to:', newProject.id)
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#282c34]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-purple-600 rounded-xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              VideoSplice AI
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Intelligent video segmentation powered by local AI with BullMQ job queue system.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6">
          <ThemeToggle />
          <SettingsDialog />
        </div>

        <BullMQQueue onViewProject={handleViewProject} />

        <Toaster />
      </div>
    </div>
  )
}

export default App
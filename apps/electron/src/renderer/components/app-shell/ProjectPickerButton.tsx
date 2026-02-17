import { FolderOpen, Folder } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuSub,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
  StyledDropdownMenuSubTrigger,
  StyledDropdownMenuSubContent,
} from "@/components/ui/styled-dropdown"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@ws-workspace/ui"
import type { Project } from "@shared/types"

interface ProjectPickerButtonProps {
  projects: Project[]
  onSelectProject: (project: Project) => void
}

export function ProjectPickerButton({ projects, onSelectProject }: ProjectPickerButtonProps) {
  // Group projects by category
  const grouped = new Map<string, Project[]>()
  const uncategorized: Project[] = []

  for (const project of projects) {
    if (project.category) {
      const list = grouped.get(project.category) || []
      list.push(project)
      grouped.set(project.category, list)
    } else {
      uncategorized.push(project)
    }
  }

  const categories = [...grouped.keys()].sort()

  return (
    <div className="px-2 pb-1 shrink-0">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 py-[7px] px-2 text-[13px] font-normal rounded-[6px]"
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                Open Project
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Start a session in a project directory</TooltipContent>
        </Tooltip>

        <StyledDropdownMenuContent side="right" align="start" sideOffset={8}>
          {categories.map((category, idx) => (
            <DropdownMenuSub key={category}>
              <StyledDropdownMenuSubTrigger>
                <Folder className="h-3.5 w-3.5 shrink-0 mr-2" />
                {category}
              </StyledDropdownMenuSubTrigger>
              <StyledDropdownMenuSubContent sideOffset={4}>
                {grouped.get(category)!.map(project => (
                  <StyledDropdownMenuItem
                    key={project.path}
                    onClick={() => onSelectProject(project)}
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 mr-2" />
                    {project.name}
                  </StyledDropdownMenuItem>
                ))}
              </StyledDropdownMenuSubContent>
            </DropdownMenuSub>
          ))}

          {categories.length > 0 && uncategorized.length > 0 && (
            <StyledDropdownMenuSeparator />
          )}

          {uncategorized.map(project => (
            <StyledDropdownMenuItem
              key={project.path}
              onClick={() => onSelectProject(project)}
            >
              <Folder className="h-3.5 w-3.5 shrink-0 mr-2" />
              {project.name}
            </StyledDropdownMenuItem>
          ))}
        </StyledDropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
